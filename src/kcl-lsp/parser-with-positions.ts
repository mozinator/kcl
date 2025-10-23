/**
 * Parser with Position Tracking
 *
 * Enhanced parser that tracks positions for better error reporting.
 */

import type { Program } from "../kcl-lang/ast"
import type { TokWithPos } from "./lexer-with-positions"
import { parse as originalParse } from "../kcl-lang/parser"

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public character: number,
    public length: number = 1
  ) {
    super(message)
    this.name = "ParseError"
  }
}

/**
 * Parse tokens with position tracking for errors
 */
export function parseWithPositions(tokens: TokWithPos[]): Program {
  // Convert tokens to regular format for the parser
  const regularTokens = tokens.map(t => {
    const { range, ...rest } = t as any
    return rest
  })

  // Track current token index
  let currentTokenIndex = 0

  // Wrap the parse to catch errors and enhance them with position info
  try {
    return originalParse(regularTokens)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Extract token index from error message if available
    const posMatch = message.match(/position (\d+)/)
    if (posMatch) {
      const tokenIndex = parseInt(posMatch[1], 10)
      if (tokenIndex >= 0 && tokenIndex < tokens.length) {
        const token = tokens[tokenIndex]
        throw new ParseError(
          message,
          token.range.start.line,
          token.range.start.character,
          token.range.end.character - token.range.start.character
        )
      }
    }

    // Try to find the last valid token before error
    // The error likely occurred at or after the last token we can see
    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 2] || tokens[0] // -2 to skip EOF
      throw new ParseError(
        message,
        lastToken.range.end.line,
        lastToken.range.end.character,
        1
      )
    }

    // Fallback to line 0
    throw new ParseError(message, 0, 0, 1)
  }
}
