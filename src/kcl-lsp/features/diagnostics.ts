/**
 * Diagnostics Feature
 *
 * Reports parse errors and type errors as LSP diagnostics.
 */

import type { Diagnostic, Range } from "../protocol"
import type { ParseResult } from "../document-manager"
import type { Program, Stmt } from "../../kcl-lang/ast"
import { typecheck } from "../../kcl-lang/typecheck"

export function getDiagnostics(parseResult: ParseResult): Diagnostic[] {
  // If parsing failed, return parse diagnostics
  if (!parseResult.success) {
    return parseResult.diagnostics
  }

  const diagnostics: Diagnostic[] = []

  // Check for deprecated 'let' keyword usage by traversing AST
  for (let i = 0; i < parseResult.program.body.length; i++) {
    const stmt = parseResult.program.body[i]
    if (stmt.kind === "Let") {
      // Estimate position based on line offset (best effort without exact token positions)
      const line = i // Rough estimate: each statement on its own line
      diagnostics.push({
        range: {
          start: { line, character: 0 },
          end: { line, character: 3 }, // "let" is 3 chars
        },
        severity: 2, // Warning (not error)
        source: "kcl-deprecated",
        message: "The 'let' keyword is deprecated. Use direct assignment instead: 'myVar = value'",
        code: "deprecated-let-keyword",
      })
    }
  }

  // Try type checking
  try {
    typecheck(parseResult.program)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Try to extract position info from the error message
    const range = extractErrorPosition(message, parseResult)

    diagnostics.push({
      range,
      severity: 1, // Error
      source: "kcl-typecheck",
      message,
    })
  }

  return diagnostics
}

/**
 * Extract position information from error message
 */
function extractErrorPosition(message: string, parseResult: ParseResult): Range {
  // Special handling for "Missing argument" errors which mention an operation
  // Pattern: "Missing argument 'X' for operation 'Y'"
  const missingArgMatch = message.match(/Missing argument '(\w+)' for operation '(\w+)'/)
  if (missingArgMatch) {
    const [, argName, operationName] = missingArgMatch

    // Find all Call expressions to this operation in the AST
    const callPositions = findCallExpressions(parseResult.program, operationName, parseResult.tokens)

    // Use the first call (type checker reports first error encountered)
    if (callPositions.length > 0) {
      return callPositions[0]
    }

    // Fallback: look for the operation name in tokens (but not as a variable assignment)
    const callToken = findTokenNotAsAssignment(parseResult.tokens, operationName)
    if (callToken) {
      return callToken.range
    }
  }

  // Try to extract identifier names from common error patterns
  const patterns = [
    /Unknown operation: (\w+)/,
    /Unknown function: (\w+)/,
    /Unknown variable: (\w+)/,
    /Undefined: (\w+)/,
    /'(\w+)'/,  // Any identifier in quotes
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      const identifier = match[1]

      // For "Unknown" errors, find the identifier where it's used (not defined)
      // Search from the end to find the last occurrence
      const tokens = parseResult.tokens.filter(t =>
        t.k === "Ident" && t.v === identifier
      )

      if (tokens.length > 0) {
        // Return last occurrence (more likely to be the usage)
        return tokens[tokens.length - 1].range
      }
    }
  }

  // Fallback: try to find any identifier mentioned in the error
  const words = message.match(/\b[a-z_][a-z0-9_]*\b/gi)
  if (words) {
    for (const word of words) {
      const tokens = parseResult.tokens.filter(t =>
        t.k === "Ident" && t.v.toLowerCase() === word.toLowerCase()
      )
      if (tokens.length > 0) {
        // Return last occurrence
        return tokens[tokens.length - 1].range
      }
    }
  }

  // Default to first line if we can't find a better position
  return {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 1 },
  }
}

/**
 * Find all Call expressions to a specific function in the AST and return their positions
 */
function findCallExpressions(program: Program, functionName: string, tokens: TokWithPos[]): Range[] {
  const positions: Range[] = []

  // Find all tokens that match the function name (excluding assignments)
  const candidateTokens: TokWithPos[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.k === "Ident" && token.v === functionName) {
      // Check if the next token is '=' (which would mean this is an assignment)
      const nextToken = tokens[i + 1]
      if (!nextToken || nextToken.k !== "Sym" || nextToken.v !== "=") {
        candidateTokens.push(token)
      }
    }
  }

  let candidateIndex = 0

  function walkExpr(expr: any): void {
    if (!expr || typeof expr !== "object") return

    if (expr.kind === "Call" && expr.callee === functionName) {
      // Map this call to the next candidate token
      if (candidateIndex < candidateTokens.length) {
        positions.push(candidateTokens[candidateIndex].range)
        candidateIndex++
      }
    }

    // Recursively walk all expression properties
    for (const key in expr) {
      const value = expr[key]
      if (Array.isArray(value)) {
        value.forEach(item => walkExpr(item))
      } else if (typeof value === "object") {
        walkExpr(value)
      }
    }
  }

  function walkStmt(stmt: any): void {
    if (!stmt || typeof stmt !== "object") return

    // Walk the expression part of statements
    if (stmt.expr) walkExpr(stmt.expr)
    if (stmt.body) {
      if (Array.isArray(stmt.body)) {
        stmt.body.forEach(walkStmt)
      }
    }

    // Walk other statement properties
    for (const key in stmt) {
      const value = stmt[key]
      if (key !== "expr" && key !== "body") {
        if (Array.isArray(value)) {
          value.forEach(item => {
            walkExpr(item)
            walkStmt(item)
          })
        } else if (typeof value === "object") {
          walkExpr(value)
        }
      }
    }
  }

  // Walk all statements in the program
  if (program.body) {
    program.body.forEach(walkStmt)
  }

  return positions
}

/**
 * Find a token that's not used as the left-hand side of an assignment
 */
function findTokenNotAsAssignment(tokens: TokWithPos[], identifier: string): TokWithPos | undefined {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.k === "Ident" && token.v === identifier) {
      // Check if the next token is '=' (which would mean this is an assignment)
      const nextToken = tokens[i + 1]
      if (!nextToken || nextToken.k !== "Sym" || nextToken.v !== "=") {
        return token
      }
    }
  }
  return undefined
}
