/**
 * Document Manager
 *
 * Manages open documents, parses them, and caches the results.
 */

import type { DocumentUri, Diagnostic, DiagnosticSeverity } from "./protocol"
import type { Program } from "../kcl-lang/ast"
import { lex } from "../lexer"
import { parse } from "../kcl-lang/parser"
import { lexWithPositions, type TokWithPos } from "./lexer-with-positions"
import { parseWithPositions, ParseError } from "./parser-with-positions"
import { buildLineOffsets } from "./positions"

export type ParseResult = {
  success: true
  tokens: TokWithPos[]
  program: Program
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
   * Parse a KCL document
   */
  private parseDocument(text: string): ParseResult {
    const lineOffsets = buildLineOffsets(text)
    const diagnostics: Diagnostic[] = []

    try {
      // First, lex with positions
      const tokens = lexWithPositions(text)

      // Then parse with position tracking
      try {
        const program = parseWithPositions(tokens)
        return {
          success: true,
          tokens,
          program,
          lineOffsets,
        }
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : String(parseError)

        // Extract position info from ParseError
        if (parseError instanceof ParseError) {
          const endChar = parseError.character + parseError.length
          diagnostics.push({
            range: {
              start: { line: parseError.line, character: parseError.character },
              end: { line: parseError.line, character: endChar },
            },
            severity: 1, // Error
            source: "kcl-parser",
            message,
          })
        } else {
          // Fallback for non-ParseError
          diagnostics.push({
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 1 },
            },
            severity: 1, // Error
            source: "kcl-parser",
            message,
          })
        }

        return {
          success: false,
          error: message,
          diagnostics,
          lineOffsets,
        }
      }
    } catch (lexError) {
      const message = lexError instanceof Error ? lexError.message : String(lexError)
      diagnostics.push({
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
        severity: 1, // Error
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
  }
}
