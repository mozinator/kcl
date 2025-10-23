/**
 * Formatting with Comment Preservation
 *
 * Enhanced formatter that preserves comments.
 */

import type { TextEdit } from "../protocol"
import type { ParseResult } from "../document-manager"
import { formatDocument as baseFormatDocument } from "./formatting"

type Comment = {
  line: number
  text: string
  isBlock: boolean
}

/**
 * Extract comments from source code
 */
function extractComments(source: string): Comment[] {
  const comments: Comment[] = []
  const lines = source.split('\n')

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]

    // Find line comments
    const lineCommentMatch = line.match(/\/\/(.*)$/)
    if (lineCommentMatch) {
      comments.push({
        line: lineIdx,
        text: lineCommentMatch[0],
        isBlock: false,
      })
    }

    // Find block comments (simple - doesn't handle multi-line blocks yet)
    const blockCommentMatch = line.match(/\/\*.*?\*\//)
    if (blockCommentMatch) {
      comments.push({
        line: lineIdx,
        text: blockCommentMatch[0],
        isBlock: true,
      })
    }
  }

  return comments
}

/**
 * Format document while preserving comments
 *
 * Better strategy: Process line-by-line, preserving comment lines exactly where they are,
 * and only format the code lines.
 */
export function formatDocumentWithComments(
  parseResult: ParseResult,
  originalSource: string
): TextEdit[] {
  if (!parseResult.success) {
    return []
  }

  const originalLines = originalSource.split('\n')

  // Extract comments from original (line-indexed)
  const commentLines = new Set<number>()
  for (let i = 0; i < originalLines.length; i++) {
    const trimmed = originalLines[i].trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      commentLines.add(i)
    }
  }

  if (commentLines.size === 0) {
    // No comments to preserve, use base formatter
    return baseFormatDocument(parseResult)
  }

  // Get base formatted output
  const baseFormatted = baseFormatDocument(parseResult)
  if (baseFormatted.length === 0) {
    return []
  }

  const formattedLines = baseFormatted[0].newText.split('\n')

  // Merge: go through original lines, preserve comments, use formatted code
  const result: string[] = []
  let formattedIdx = 0

  for (let i = 0; i < originalLines.length; i++) {
    const originalLine = originalLines[i]

    if (commentLines.has(i)) {
      // This is a comment line - preserve it exactly
      result.push(originalLine)
    } else if (originalLine.trim() === '') {
      // Blank line - skip it (let formatter control blank lines)
      continue
    } else {
      // Code line - use formatted version
      if (formattedIdx < formattedLines.length) {
        // Skip blank lines in formatted output
        while (formattedIdx < formattedLines.length && formattedLines[formattedIdx].trim() === '') {
          result.push(formattedLines[formattedIdx])
          formattedIdx++
        }

        if (formattedIdx < formattedLines.length) {
          result.push(formattedLines[formattedIdx])
          formattedIdx++
        }
      }
    }
  }

  // Add any remaining formatted lines
  while (formattedIdx < formattedLines.length) {
    result.push(formattedLines[formattedIdx])
    formattedIdx++
  }

  const finalText = result.join('\n')

  return [
    {
      range: baseFormatted[0].range,
      newText: finalText,
    },
  ]
}
