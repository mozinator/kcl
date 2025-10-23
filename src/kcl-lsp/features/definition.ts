/**
 * Go-to-Definition Feature
 *
 * Navigate to symbol definitions.
 */

import type { Position, Location } from "../protocol"
import type { ParseResult } from "../document-manager"
import { isPositionInRange } from "../positions"

export function getDefinition(
  parseResult: ParseResult,
  position: Position,
  uri: string
): Location | null {
  if (!parseResult.success) {
    return null
  }

  // Find the token at the cursor position
  const token = parseResult.tokens.find(t => isPositionInRange(position, t.range))

  if (!token || token.k !== "Ident") {
    return null
  }

  const name = token.v

  // Search for the definition in the program
  // For now, we only support same-file definitions
  const defToken = findDefinitionToken(parseResult, name)

  if (!defToken) {
    return null
  }

  return {
    uri,
    range: defToken.range,
  }
}

function findDefinitionToken(parseResult: ParseResult, name: string): any {
  if (!parseResult.success) {
    return null
  }

  // Look for 'let name' or 'fn name' in tokens
  // We need to find patterns like: [Kw "let", Ident name] or [Kw "fn", Ident name]

  for (let i = 0; i < parseResult.tokens.length - 1; i++) {
    const curr = parseResult.tokens[i]
    const next = parseResult.tokens[i + 1]

    // Check for: let name
    if (curr.k === "Kw" && curr.v === "let" && next.k === "Ident" && next.v === name) {
      return next
    }

    // Check for: fn name
    if (curr.k === "Kw" && curr.v === "fn" && next.k === "Ident" && next.v === name) {
      return next
    }
  }

  return null
}
