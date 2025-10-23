/**
 * Semantic Tokens Feature
 *
 * Provides semantic highlighting for better syntax coloring.
 */

import type { ParseResult } from "../document-manager"
import { OPS, PLANES, MATH_CONSTANTS, UNIT_CONSTANTS } from "../../kcl-lang/stdlib"

// LSP Semantic Token Types (standard)
export enum SemanticTokenType {
  namespace = 0,
  type = 1,
  class = 2,
  enum = 3,
  interface = 4,
  struct = 5,
  typeParameter = 6,
  parameter = 7,
  variable = 8,
  property = 9,
  enumMember = 10,
  event = 11,
  function = 12,
  method = 13,
  macro = 14,
  keyword = 15,
  modifier = 16,
  comment = 17,
  string = 18,
  number = 19,
  regexp = 20,
  operator = 21,
}

// Token modifiers (bitflags)
export enum SemanticTokenModifier {
  declaration = 0,
  definition = 1,
  readonly = 2,
  static = 3,
  deprecated = 4,
  abstract = 5,
  async = 6,
  modification = 7,
  documentation = 8,
  defaultLibrary = 9,
}

export type SemanticToken = {
  line: number
  startChar: number
  length: number
  tokenType: SemanticTokenType
  tokenModifiers: number
}

/**
 * Get semantic tokens legend (token types and modifiers)
 */
export function getSemanticTokensLegend() {
  const tokenTypes = [
    "namespace", "type", "class", "enum", "interface", "struct",
    "typeParameter", "parameter", "variable", "property", "enumMember",
    "event", "function", "method", "macro", "keyword", "modifier",
    "comment", "string", "number", "regexp", "operator"
  ]

  const tokenModifiers = [
    "declaration", "definition", "readonly", "static", "deprecated",
    "abstract", "async", "modification", "documentation", "defaultLibrary"
  ]

  return { tokenTypes, tokenModifiers }
}

/**
 * Generate semantic tokens from parse result
 */
export function getSemanticTokens(parseResult: ParseResult): number[] {
  if (!parseResult.success) {
    return []
  }

  const tokens: SemanticToken[] = []

  // Process each token from the lexer
  for (const token of parseResult.tokens) {
    const { start } = token.range
    const length = token.range.end.character - start.character

    if (token.k === "Kw") {
      // Keywords
      tokens.push({
        line: start.line,
        startChar: start.character,
        length,
        tokenType: SemanticTokenType.keyword,
        tokenModifiers: 0,
      })
    } else if (token.k === "Num") {
      // Numbers
      tokens.push({
        line: start.line,
        startChar: start.character,
        length,
        tokenType: SemanticTokenType.number,
        tokenModifiers: 0,
      })
    } else if (token.k === "Str") {
      // Strings
      tokens.push({
        line: start.line,
        startChar: start.character,
        length,
        tokenType: SemanticTokenType.string,
        tokenModifiers: 0,
      })
    } else if (token.k === "Ident") {
      // Classify identifiers based on context
      const name = token.v
      let tokenType = SemanticTokenType.variable
      let tokenModifiers = 0

      // Check if it's a stdlib function
      if (name in OPS) {
        tokenType = SemanticTokenType.function
        tokenModifiers = 1 << SemanticTokenModifier.defaultLibrary
      }
      // Check if it's a constant
      else if (name in PLANES || name in MATH_CONSTANTS || name in UNIT_CONSTANTS) {
        tokenType = SemanticTokenType.variable
        tokenModifiers = (1 << SemanticTokenModifier.readonly) | (1 << SemanticTokenModifier.defaultLibrary)
      }
      // Check if it's a variable declaration (in the AST)
      else if (parseResult.success) {
        const isDeclared = isVariableDeclaration(parseResult.program, name, start.line)
        if (isDeclared) {
          tokenModifiers = 1 << SemanticTokenModifier.declaration
        }
      }

      tokens.push({
        line: start.line,
        startChar: start.character,
        length,
        tokenType,
        tokenModifiers,
      })
    } else if (token.k === "Op" || token.k === "Sym" || token.k === "Pipe" || token.k === "DoubleColon") {
      // Operators
      tokens.push({
        line: start.line,
        startChar: start.character,
        length,
        tokenType: SemanticTokenType.operator,
        tokenModifiers: 0,
      })
    }
  }

  // Convert to LSP delta-encoded format
  return encodeSemanticTokens(tokens)
}

/**
 * Check if an identifier is a variable declaration at a given line
 */
function isVariableDeclaration(program: any, name: string, line: number): boolean {
  for (const stmt of program.body) {
    if ((stmt.kind === "Let" || stmt.kind === "FnDef") && stmt.name === name) {
      return true
    }
  }
  return false
}

/**
 * Encode semantic tokens in LSP delta format
 * Each token is 5 integers: deltaLine, deltaStartChar, length, tokenType, tokenModifiers
 */
function encodeSemanticTokens(tokens: SemanticToken[]): number[] {
  // Sort by line, then by character
  tokens.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line
    return a.startChar - b.startChar
  })

  const encoded: number[] = []
  let prevLine = 0
  let prevChar = 0

  for (const token of tokens) {
    const deltaLine = token.line - prevLine
    const deltaChar = deltaLine === 0 ? token.startChar - prevChar : token.startChar

    encoded.push(
      deltaLine,
      deltaChar,
      token.length,
      token.tokenType,
      token.tokenModifiers
    )

    prevLine = token.line
    prevChar = token.startChar
  }

  return encoded
}
