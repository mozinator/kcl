/**
 * References Feature
 *
 * Finds all references to a symbol in the document.
 */

import type { Location, Position } from "../protocol"
import type { ParseResult } from "../document-manager"
import type { Program, Stmt, Expr } from "../../kcl-lang/ast"
import { positionToOffset } from "../positions"

/**
 * Find all references to a symbol at the given position
 */
export function getReferences(
  parseResult: ParseResult,
  position: Position,
  uri: string,
  includeDeclaration: boolean = true
): Location[] | null {
  if (!parseResult.success) {
    return null
  }

  const offset = positionToOffset(position, parseResult.lineOffsets)

  // Find the token at the position
  const token = parseResult.tokens.find(
    t =>
      t.range.start.line === position.line &&
      t.range.start.character <= position.character &&
      t.range.end.character >= position.character
  )

  if (!token || token.k !== "Ident") {
    return null
  }

  const symbolName = token.v as string
  const locations: Location[] = []

  // Find all occurrences of this identifier in the token stream
  for (const t of parseResult.tokens) {
    if (t.k === "Ident" && t.v === symbolName) {
      // Check context to see if this is a reference or declaration
      const isDeclaration = isTokenDeclaration(t, parseResult)

      if (includeDeclaration || !isDeclaration) {
        locations.push({
          uri,
          range: t.range,
        })
      }
    }
  }

  return locations
}

/**
 * Check if a token is part of a declaration
 */
function isTokenDeclaration(token: any, parseResult: ParseResult): boolean {
  // Find the token index
  const tokenIndex = parseResult.tokens.indexOf(token)
  if (tokenIndex === -1) return false

  // Look at the previous token to determine context
  if (tokenIndex > 0) {
    const prevToken = parseResult.tokens[tokenIndex - 1]

    // After 'let', 'fn', this is a declaration
    if (prevToken.k === "Let" || prevToken.k === "Fn") {
      return true
    }

    // After 'fn name(' in parameters, check if we're in a parameter list
    if (prevToken.k === "LParen" || prevToken.k === "Comma") {
      // Look further back to see if there's a 'fn' keyword
      for (let i = tokenIndex - 2; i >= 0; i--) {
        const t = parseResult.tokens[i]
        if (t.k === "Fn") {
          return true // Parameter declaration
        }
        if (t.k === "LBrace" || t.k === "RBrace") {
          break // Exited the function context
        }
      }
    }

    // After '@' in parameters, this is an unlabeled parameter
    if (prevToken.k === "At") {
      return true
    }
  }

  return false
}
