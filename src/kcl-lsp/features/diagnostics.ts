/**
 * Diagnostics Feature
 *
 * Reports parse errors and type errors as LSP diagnostics.
 */

import type { Diagnostic, Range } from "../protocol"
import type { ParseResult } from "../document-manager"
import { typecheck } from "../../kcl-lang/typecheck"

export function getDiagnostics(parseResult: ParseResult): Diagnostic[] {
  // If parsing failed, return parse diagnostics
  if (!parseResult.success) {
    return parseResult.diagnostics
  }

  const diagnostics: Diagnostic[] = []

  // Check for deprecated 'let' keyword usage
  for (const token of parseResult.tokens) {
    if (token.k === "Kw" && token.v === "let") {
      diagnostics.push({
        range: token.range,
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
  // Try to extract identifier names from common error patterns
  const patterns = [
    /Unknown function: (\w+)/,
    /Unknown variable: (\w+)/,
    /Undefined: (\w+)/,
    /'(\w+)'/,  // Any identifier in quotes
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      const identifier = match[1]

      // Find this identifier in the tokens
      const token = parseResult.tokens.find(t =>
        t.k === "Ident" && t.v === identifier
      )

      if (token) {
        return token.range
      }
    }
  }

  // Fallback: try to find any identifier mentioned in the error
  const words = message.match(/\b[a-z_][a-z0-9_]*\b/gi)
  if (words) {
    for (const word of words) {
      const token = parseResult.tokens.find(t =>
        t.k === "Ident" && t.v.toLowerCase() === word.toLowerCase()
      )
      if (token) {
        return token.range
      }
    }
  }

  // Default to first line if we can't find a better position
  return {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 1 },
  }
}
