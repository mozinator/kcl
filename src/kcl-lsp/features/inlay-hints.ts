/**
 * Inlay Hints Feature
 *
 * Shows inline hints in the editor:
 * - Parameter names in function calls
 * - Inferred types for variables
 * - Return types for functions
 */

import type { Position, Range } from "../protocol"
import type { ParseResult } from "../document-manager"
import type { Expr, Stmt, Param } from "../../kcl-lang/ast"
import { findTokenAt } from "../positions"

export type InlayHintKind = 1 | 2 // 1 = Type, 2 = Parameter

export type InlayHint = {
  position: Position
  label: string
  kind?: InlayHintKind
  paddingLeft?: boolean
  paddingRight?: boolean
}

/**
 * Get inlay hints for a document range
 */
export function getInlayHints(
  parseResult: ParseResult,
  range: Range
): InlayHint[] {
  if (!parseResult.success) {
    return []
  }

  const hints: InlayHint[] = []

  // Walk through statements in the program
  for (const stmt of parseResult.program.body) {
    // Get hints for function parameters
    if (stmt.kind === "FnDef") {
      // Show parameter types if not specified
      for (const param of stmt.params) {
        if (!param.type) {
          // Could show inferred type here (requires type inference)
          // For now, skip
        }
      }
    }

    // Get hints for variable declarations
    if (stmt.kind === "Let") {
      // Find the token for the let statement
      const token = findLetToken(parseResult, stmt.name)
      if (token) {
        // Could show inferred type here
        // For now, we'll add a basic hint for numbers
        if (stmt.expr.kind === "Number") {
          hints.push({
            position: {
              line: token.range.end.line,
              character: token.range.end.character,
            },
            label: `: number${stmt.expr.unit ? stmt.expr.unit : ""}`,
            kind: 1, // Type
            paddingLeft: false,
            paddingRight: true,
          })
        }
      }
    }

    // Get hints for function calls (show parameter names)
    collectCallHints(stmt, hints, parseResult)
  }

  // Filter hints to only those in the requested range
  return hints.filter(hint =>
    isPositionInRange(hint.position, range)
  )
}

/**
 * Collect inlay hints for function calls (parameter names)
 */
function collectCallHints(stmt: Stmt, hints: InlayHint[], parseResult: ParseResult) {
  if (stmt.kind === "ExprStmt") {
    collectExprCallHints(stmt.expr, hints, parseResult)
  } else if (stmt.kind === "Let" || stmt.kind === "Assign") {
    collectExprCallHints(stmt.expr, hints, parseResult)
  } else if (stmt.kind === "Return" && stmt.expr) {
    collectExprCallHints(stmt.expr, hints, parseResult)
  } else if (stmt.kind === "FnDef") {
    // Check function body
    for (const bodyStmt of stmt.body) {
      collectCallHints(bodyStmt, hints, parseResult)
    }
    if (stmt.returnExpr) {
      collectExprCallHints(stmt.returnExpr, hints, parseResult)
    }
  }
}

/**
 * Collect call hints from expressions
 */
function collectExprCallHints(expr: Expr, hints: InlayHint[], parseResult: ParseResult) {
  if (expr.kind === "Call") {
    // Find positional arguments (keys like $0, $1, $2)
    const positionalArgs: Array<{ key: string; value: Expr }> = []

    for (const [key, value] of Object.entries(expr.args)) {
      if (/^\$\d+$/.test(key)) {
        positionalArgs.push({ key, value })
      }
    }

    // Sort by position
    positionalArgs.sort((a, b) => {
      const aNum = parseInt(a.key.substring(1))
      const bNum = parseInt(b.key.substring(1))
      return aNum - bNum
    })

    // Add parameter name hints for positional arguments
    // Note: We'd need function signature info to show actual parameter names
    // For now, just show that they're positional
    for (let i = 0; i < positionalArgs.length; i++) {
      const arg = positionalArgs[i]
      const position = findExprPosition(arg.value, parseResult)
      if (position) {
        // This is a simplified hint - ideally we'd look up the function signature
        hints.push({
          position: {
            line: position.line,
            character: position.character,
          },
          label: `${getOrdinal(i)}: `,
          kind: 2, // Parameter
          paddingLeft: false,
          paddingRight: false,
        })
      }
    }

    // Recursively process nested calls
    for (const value of Object.values(expr.args)) {
      collectExprCallHints(value, hints, parseResult)
    }
  } else if (expr.kind === "Pipe") {
    collectExprCallHints(expr.left, hints, parseResult)
    collectExprCallHints(expr.right, hints, parseResult)
  } else if (expr.kind === "BinaryOp") {
    collectExprCallHints(expr.left, hints, parseResult)
    collectExprCallHints(expr.right, hints, parseResult)
  } else if (expr.kind === "UnaryMinus" || expr.kind === "UnaryNot") {
    collectExprCallHints(expr.operand, hints, parseResult)
  } else if (expr.kind === "Array") {
    for (const element of expr.elements) {
      collectExprCallHints(element, hints, parseResult)
    }
  } else if (expr.kind === "Object") {
    for (const value of Object.values(expr.fields)) {
      collectExprCallHints(value, hints, parseResult)
    }
  } else if (expr.kind === "If") {
    collectExprCallHints(expr.condition, hints, parseResult)
    collectExprCallHints(expr.thenBranch, hints, parseResult)
    for (const branch of expr.elseIfBranches) {
      collectExprCallHints(branch.condition, hints, parseResult)
      collectExprCallHints(branch.body, hints, parseResult)
    }
    if (expr.elseBranch) {
      collectExprCallHints(expr.elseBranch, hints, parseResult)
    }
  } else if (expr.kind === "Index") {
    collectExprCallHints(expr.array, hints, parseResult)
    collectExprCallHints(expr.index, hints, parseResult)
  } else if (expr.kind === "MemberAccess") {
    collectExprCallHints(expr.object, hints, parseResult)
  }
}

/**
 * Find the position of an expression (approximation)
 */
function findExprPosition(expr: Expr, parseResult: ParseResult): Position | null {
  // This is a simplified implementation
  // In a real implementation, we'd track source positions for all AST nodes

  if (expr.kind === "Number" || expr.kind === "String" || expr.kind === "Bool") {
    // Find the token for this literal
    for (const token of parseResult.tokens) {
      if (expr.kind === "Number" && token.k === "Num" && token.v === (expr as any).value) {
        return token.range.start
      }
      if (expr.kind === "String" && token.k === "Str" && token.v === (expr as any).value) {
        return token.range.start
      }
    }
  } else if (expr.kind === "Var") {
    // Find the identifier token
    for (const token of parseResult.tokens) {
      if (token.k === "Ident" && token.v === (expr as any).name) {
        return token.range.start
      }
    }
  }

  return null
}

/**
 * Find the let keyword token for a variable
 */
function findLetToken(parseResult: ParseResult, name: string): any {
  let foundLet = false
  for (const token of parseResult.tokens) {
    if (token.k === "Kw" && token.v === "let") {
      foundLet = true
    } else if (foundLet && token.k === "Ident" && token.v === name) {
      return token
    }
  }
  return null
}

/**
 * Check if a position is within a range
 */
function isPositionInRange(position: Position, range: Range): boolean {
  if (position.line < range.start.line || position.line > range.end.line) {
    return false
  }

  if (position.line === range.start.line && position.character < range.start.character) {
    return false
  }

  if (position.line === range.end.line && position.character > range.end.character) {
    return false
  }

  return true
}

/**
 * Get ordinal string for parameter index
 */
function getOrdinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
}
