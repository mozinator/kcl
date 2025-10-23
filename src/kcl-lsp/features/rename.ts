/**
 * Rename Refactoring Feature
 *
 * Renames all occurrences of a symbol.
 */

import type { Position, TextEdit } from "../protocol"
import type { ParseResult } from "../document-manager"
import { isPositionInRange } from "../positions"

export type WorkspaceEdit = {
  changes: Record<string, TextEdit[]>
}

/**
 * Prepare rename - check if rename is valid at this position
 */
export function prepareRename(
  parseResult: ParseResult,
  position: Position
): { range: { start: Position; end: Position }; placeholder: string } | null {
  if (!parseResult.success) {
    return null
  }

  // Find the identifier at this position
  const token = parseResult.tokens.find(t =>
    t.k === "Ident" && isPositionInRange(position, t.range)
  )

  if (!token || token.k !== "Ident") {
    return null
  }

  return {
    range: token.range,
    placeholder: token.v,
  }
}

/**
 * Perform rename
 */
export function performRename(
  parseResult: ParseResult,
  position: Position,
  newName: string,
  uri: string
): WorkspaceEdit | null {
  if (!parseResult.success) {
    return null
  }

  // Find the identifier to rename
  const token = parseResult.tokens.find(t =>
    t.k === "Ident" && isPositionInRange(position, t.range)
  )

  if (!token || token.k !== "Ident") {
    return null
  }

  const oldName = token.v

  // Find all occurrences of this identifier
  const edits: TextEdit[] = []

  for (const t of parseResult.tokens) {
    if (t.k === "Ident" && t.v === oldName) {
      edits.push({
        range: t.range,
        newText: newName,
      })
    }
  }

  if (edits.length === 0) {
    return null
  }

  return {
    changes: {
      [uri]: edits,
    },
  }
}
