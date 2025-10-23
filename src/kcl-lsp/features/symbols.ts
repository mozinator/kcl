/**
 * Document Symbols Feature
 *
 * Provides outline/structure view of the document.
 */

import type { Range } from "../protocol"
import type { ParseResult } from "../document-manager"
import type { Program, Stmt } from "../../kcl-lang/ast"

export enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26,
}

export type DocumentSymbol = {
  name: string
  detail?: string
  kind: SymbolKind
  range: Range
  selectionRange: Range
  children?: DocumentSymbol[]
}

/**
 * Get document symbols (outline)
 */
export function getDocumentSymbols(parseResult: ParseResult): DocumentSymbol[] {
  if (!parseResult.success) {
    return []
  }

  const symbols: DocumentSymbol[] = []

  for (const stmt of parseResult.program.body) {
    const symbol = statementToSymbol(stmt, parseResult)
    if (symbol) {
      symbols.push(symbol)
    }
  }

  return symbols
}

/**
 * Convert a statement to a document symbol
 */
function statementToSymbol(stmt: Stmt, parseResult: ParseResult): DocumentSymbol | null {
  if (stmt.kind === "Let") {
    // Find the token for this let statement
    const token = findIdentifierToken(parseResult, stmt.name)
    if (!token) return null

    return {
      name: stmt.name,
      detail: "variable",
      kind: SymbolKind.Variable,
      range: token.range,
      selectionRange: token.range,
    }
  }

  if (stmt.kind === "FnDef") {
    const token = findIdentifierToken(parseResult, stmt.name)
    if (!token) return null

    // Build parameter list
    const paramList = stmt.params.map(p => p.name).join(", ")

    return {
      name: stmt.name,
      detail: `fn(${paramList})`,
      kind: SymbolKind.Function,
      range: token.range,
      selectionRange: token.range,
    }
  }

  if (stmt.kind === "Export") {
    // Recursively get symbol for exported statement
    return statementToSymbol(stmt.stmt, parseResult)
  }

  return null
}

/**
 * Find an identifier token by name
 */
function findIdentifierToken(parseResult: ParseResult, name: string): any {
  for (const token of parseResult.tokens) {
    if (token.k === "Ident" && token.v === name) {
      return token
    }
  }
  return null
}
