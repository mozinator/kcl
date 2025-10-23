/**
 * Position Tracking Utilities
 *
 * Helper functions for working with source positions in LSP.
 */

import type { Position, Range } from "./protocol"

export type SourcePosition = {
  line: number      // 0-based
  character: number // 0-based
  offset: number    // byte offset in source
}

export type SourceRange = {
  start: SourcePosition
  end: SourcePosition
}

/**
 * Build a line offset table from source code.
 * Returns array where lineOffsets[i] = byte offset of line i.
 */
export function buildLineOffsets(src: string): number[] {
  const offsets = [0] // Line 0 starts at offset 0
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '\n') {
      offsets.push(i + 1)
    }
  }
  return offsets
}

/**
 * Convert byte offset to Position
 */
export function offsetToPosition(offset: number, lineOffsets: number[]): Position {
  // Binary search for the line
  let line = 0
  for (let i = 0; i < lineOffsets.length - 1; i++) {
    if (offset >= lineOffsets[i] && offset < lineOffsets[i + 1]) {
      line = i
      break
    }
  }
  if (offset >= lineOffsets[lineOffsets.length - 1]) {
    line = lineOffsets.length - 1
  }

  const lineStart = lineOffsets[line]
  const character = offset - lineStart

  return { line, character }
}

/**
 * Convert Position to byte offset
 */
export function positionToOffset(position: Position, lineOffsets: number[]): number {
  if (position.line >= lineOffsets.length) {
    return lineOffsets[lineOffsets.length - 1]
  }
  return lineOffsets[position.line] + position.character
}

/**
 * Check if a position is within a range
 */
export function isPositionInRange(pos: Position, range: Range): boolean {
  if (pos.line < range.start.line || pos.line > range.end.line) {
    return false
  }
  if (pos.line === range.start.line && pos.character < range.start.character) {
    return false
  }
  if (pos.line === range.end.line && pos.character > range.end.character) {
    return false
  }
  return true
}
