/**
 * Folding Ranges Feature
 *
 * Provides code folding/collapsing support for multi-line constructs.
 */

import type { ParseResult } from "../document-manager"
import type { TokWithPos } from "../lexer-with-positions"

export type FoldingRangeKind = "comment" | "imports" | "region"

export type FoldingRange = {
  startLine: number
  endLine: number
  startCharacter?: number
  endCharacter?: number
  kind?: FoldingRangeKind
}

/**
 * Get folding ranges for a document
 */
export function getFoldingRanges(parseResult: ParseResult): FoldingRange[] {
  if (!parseResult.success) {
    return []
  }

  const ranges: FoldingRange[] = []

  // Add ranges for brace pairs (functions, objects, arrays, if expressions)
  ranges.push(...getBraceFoldingRanges(parseResult.tokens))

  // Add ranges for block comments
  ranges.push(...getCommentFoldingRanges(parseResult))

  // Add ranges for consecutive import statements
  ranges.push(...getImportFoldingRanges(parseResult))

  return ranges
}

/**
 * Find folding ranges for brace pairs ({ })
 */
function getBraceFoldingRanges(tokens: TokWithPos[]): FoldingRange[] {
  const ranges: FoldingRange[] = []
  const braceStack: Array<{ line: number; character: number }> = []

  for (const token of tokens) {
    if (token.k === "LBrace") {
      braceStack.push({
        line: token.range.start.line,
        character: token.range.start.character,
      })
    } else if (token.k === "RBrace") {
      const start = braceStack.pop()
      if (start) {
        const endLine = token.range.start.line

        // Only create folding range if it spans multiple lines
        if (endLine > start.line) {
          ranges.push({
            startLine: start.line,
            endLine: endLine,
          })
        }
      }
    }
  }

  return ranges
}

/**
 * Find folding ranges for block comments
 */
function getCommentFoldingRanges(parseResult: ParseResult): FoldingRange[] {
  const ranges: FoldingRange[] = []

  // Check program-level leading trivia for multi-line comment blocks
  if (parseResult.success && parseResult.program.leadingTrivia) {
    for (const item of parseResult.program.leadingTrivia) {
      if (item.type === 'comment' && item.isBlock) {
        // For block comments, we'd need position info in trivia
        // This is a limitation of the current trivia structure
        // Skipping for now
      }
    }
  }

  // Check statement-level trivia for consecutive line comments
  if (parseResult.success) {
    let commentBlockStart: number | null = null
    let commentBlockEnd: number | null = null

    for (const stmt of parseResult.program.body) {
      if (stmt.trivia?.leading) {
        for (const item of stmt.trivia.leading) {
          if (item.type === 'comment' && !item.isBlock) {
            // Track consecutive line comments
            // Would need position info to implement properly
            // Skipping for now due to trivia not having positions
          }
        }
      }
    }
  }

  return ranges
}

/**
 * Find folding ranges for consecutive import statements
 */
function getImportFoldingRanges(parseResult: ParseResult): FoldingRange[] {
  if (!parseResult.success) {
    return []
  }

  const ranges: FoldingRange[] = []
  let importBlockStart: number | null = null
  let importBlockEnd: number | null = null

  // Find consecutive import statements
  for (let i = 0; i < parseResult.program.body.length; i++) {
    const stmt = parseResult.program.body[i]

    if (stmt.kind === "Import" || (stmt.kind === "Export" && stmt.stmt.kind === "Import")) {
      // Find the import keyword token to get position
      const importToken = findImportToken(parseResult.tokens, i)
      if (importToken) {
        if (importBlockStart === null) {
          importBlockStart = importToken.range.start.line
        }
        importBlockEnd = importToken.range.end.line
      }
    } else {
      // End of import block
      if (importBlockStart !== null && importBlockEnd !== null && importBlockEnd > importBlockStart) {
        ranges.push({
          startLine: importBlockStart,
          endLine: importBlockEnd,
          kind: "imports",
        })
      }
      importBlockStart = null
      importBlockEnd = null
    }
  }

  // Handle import block at end of file
  if (importBlockStart !== null && importBlockEnd !== null && importBlockEnd > importBlockStart) {
    ranges.push({
      startLine: importBlockStart,
      endLine: importBlockEnd,
      kind: "imports",
    })
  }

  return ranges
}

/**
 * Find the import keyword token for a statement
 */
function findImportToken(tokens: TokWithPos[], stmtIndex: number): TokWithPos | null {
  // This is a simplified implementation
  // In a real implementation, we'd need better position tracking in the AST
  for (const token of tokens) {
    if (token.k === "Import") {
      return token
    }
  }
  return null
}
