/**
 * Completion Feature
 *
 * Provides code completion for KCL.
 */

import type { Position, CompletionItem, CompletionItemKind, CompletionList } from "../protocol"
import type { ParseResult } from "../document-manager"
import { OPS, PLANES, MATH_CONSTANTS, UNIT_CONSTANTS } from "../../kcl-lang/stdlib"

export function getCompletions(parseResult: ParseResult, position: Position): CompletionList {
  const items: CompletionItem[] = []

  // Add stdlib operations
  for (const [name, op] of Object.entries(OPS)) {
    const params = op.params || []
    const paramStr = params.map((p: any) => p.name).join(", ")

    items.push({
      label: name,
      kind: 3, // Function
      detail: `fn(${paramStr})`,
      documentation: op.description || "",
      insertText: `${name}()`,
    })
  }

  // Add plane constants
  for (const [name, plane] of Object.entries(PLANES)) {
    items.push({
      label: name,
      kind: 21, // Constant
      detail: "Plane",
      documentation: "Built-in plane constant",
    })
  }

  // Add math constants
  for (const [name, value] of Object.entries(MATH_CONSTANTS)) {
    items.push({
      label: name,
      kind: 21, // Constant
      detail: `${value}`,
      documentation: "Math constant",
    })
  }

  // Add unit constants
  for (const [name, value] of Object.entries(UNIT_CONSTANTS)) {
    items.push({
      label: name,
      kind: 21, // Constant
      detail: `${value}`,
      documentation: "Unit constant",
    })
  }

  // Add keywords
  const keywords = ["let", "fn", "return", "if", "else"]
  for (const kw of keywords) {
    items.push({
      label: kw,
      kind: 14, // Keyword
      detail: "keyword",
    })
  }

  // If parse succeeded, add variables from scope
  if (parseResult.success) {
    const variables = extractVariablesFromProgram(parseResult.program)
    for (const varName of variables) {
      items.push({
        label: varName,
        kind: 6, // Variable
        detail: "variable",
      })
    }
  }

  return {
    isIncomplete: false,
    items,
  }
}

function extractVariablesFromProgram(program: any): string[] {
  const variables: string[] = []

  for (const stmt of program.body) {
    if (stmt.kind === "Let") {
      variables.push(stmt.name)
    } else if (stmt.kind === "FnDef") {
      variables.push(stmt.name)
    }
  }

  return variables
}
