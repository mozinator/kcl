/**
 * Document Manager
 *
 * Manages open documents, parses them, and caches the results.
 */

import type { DocumentUri, Diagnostic, DiagnosticSeverity } from "./protocol"
import type { Program } from "../kcl-lang/ast"
import { parse } from "../kcl-lang/parser"
import { lexWithPositions, type TokWithPos } from "./lexer-with-positions"
import { buildLineOffsets } from "./positions"

export type ParseResult = {
  success: true
  program: Program
  tokens: TokWithPos[]  // For LSP features (hover, definition, etc.)
  lineOffsets: number[]
} | {
  success: false
  error: string
  diagnostics: Diagnostic[]
  lineOffsets: number[]
}

export class DocumentManager {
  private documents = new Map<DocumentUri, {
    text: string
    version: number
    parseResult: ParseResult
  }>()

  /**
   * Open a document
   */
  open(uri: DocumentUri, text: string, version: number) {
    const parseResult = this.parseDocument(text)
    this.documents.set(uri, { text, version, parseResult })
    return parseResult
  }

  /**
   * Update a document
   */
  update(uri: DocumentUri, text: string, version: number) {
    const parseResult = this.parseDocument(text)
    this.documents.set(uri, { text, version, parseResult })
    return parseResult
  }

  /**
   * Close a document
   */
  close(uri: DocumentUri) {
    this.documents.delete(uri)
  }

  /**
   * Get a document
   */
  get(uri: DocumentUri) {
    return this.documents.get(uri)
  }

  /**
   * Get document text
   */
  getText(uri: DocumentUri): string | undefined {
    return this.documents.get(uri)?.text
  }

  /**
   * Get parse result for a document
   */
  getParseResult(uri: DocumentUri): ParseResult | undefined {
    return this.documents.get(uri)?.parseResult
  }

  /**
   * Parse a KCL document with CST support
   */
  private parseDocument(text: string): ParseResult {
    const lineOffsets = buildLineOffsets(text)
    const diagnostics: Diagnostic[] = []

    // Lex with positions first for better error reporting
    let tokens: TokWithPos[] = []
    try {
      tokens = lexWithPositions(text)
    } catch (lexError) {
      const message = lexError instanceof Error ? lexError.message : String(lexError)
      diagnostics.push({
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
        severity: 1,
        source: "kcl-lexer",
        message,
      })

      return {
        success: false,
        error: message,
        diagnostics,
        lineOffsets,
      }
    }

    try {
      // Parse with CST (includes trivia)
      const program = parse(text)

      return {
        success: true,
        program,
        tokens,
        lineOffsets,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      // Extract token index from error message
      const posMatch = message.match(/position (\d+)/)
      let line = 0
      let character = 0
      let length = 1

      if (posMatch && tokens.length > 0) {
        const tokenIndex = parseInt(posMatch[1], 10)
        // Use the positioned token if available
        if (tokenIndex >= 0 && tokenIndex < tokens.length) {
          const token = tokens[tokenIndex]
          line = token.range.start.line
          character = token.range.start.character
          length = token.range.end.character - token.range.start.character
        } else if (tokenIndex >= tokens.length && tokens.length > 1) {
          // Error at EOF - use last non-EOF token's end position
          const lastToken = tokens[tokens.length - 2]
          line = lastToken.range.end.line
          character = lastToken.range.end.character
        }
      } else if (tokens.length > 1) {
        // No position in error message, use last token as best guess
        const lastToken = tokens[tokens.length - 2]
        line = lastToken.range.end.line
        character = lastToken.range.end.character
      }

      diagnostics.push({
        range: {
          start: { line, character },
          end: { line, character: character + length },
        },
        severity: 1, // Error
        source: "kcl-parser",
        message,
      })

      return {
        success: false,
        error: message,
        diagnostics,
        lineOffsets,
      }
    }
  }
}
