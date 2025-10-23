/**
 * Signature Help Feature
 *
 * Provides parameter hints when calling functions.
 */

import type { Position } from "../protocol"
import type { ParseResult } from "../document-manager"
import { OPS } from "../../kcl-lang/stdlib"
import { positionToOffset } from "../positions"

export type SignatureHelp = {
  signatures: SignatureInformation[]
  activeSignature?: number
  activeParameter?: number
}

export type SignatureInformation = {
  label: string
  documentation?: string
  parameters?: ParameterInformation[]
}

export type ParameterInformation = {
  label: string | [number, number] // string or [start, end] in signature label
  documentation?: string
}

/**
 * Get signature help at a position
 */
export function getSignatureHelp(
  parseResult: ParseResult,
  position: Position
): SignatureHelp | null {
  if (!parseResult.success) {
    return null
  }

  const text = getTextUpToPosition(parseResult, position)

  // Find the current function call context
  const funcCall = findCurrentFunctionCall(text)
  if (!funcCall) {
    return null
  }

  // Check if it's a stdlib function
  if (!(funcCall.name in OPS)) {
    return null
  }

  const op = OPS[funcCall.name]
  const params = op.params || []

  // Build signature label
  const paramLabels = params.map((p: any) => `${p.name}: ${p.ty}`)
  const label = `${funcCall.name}(${paramLabels.join(", ")})`

  // Build parameter information
  const parameters: ParameterInformation[] = params.map((p: any) => ({
    label: `${p.name}: ${p.ty}`,
    documentation: p.optional ? "Optional parameter" : undefined,
  }))

  return {
    signatures: [
      {
        label,
        documentation: (op as any).description || "",
        parameters,
      },
    ],
    activeSignature: 0,
    activeParameter: funcCall.activeParam,
  }
}

/**
 * Get text content up to a position
 */
function getTextUpToPosition(parseResult: ParseResult, position: Position): string {
  const offset = positionToOffset(position, parseResult.lineOffsets)
  // We need the original text - let's reconstruct from tokens
  let text = ""
  for (const token of parseResult.tokens) {
    const tokenEnd = positionToOffset(token.range.end, parseResult.lineOffsets)
    if (tokenEnd > offset) break

    // Reconstruct token text
    if (token.k === "Ident" || token.k === "Kw") {
      text += token.v
    } else if (token.k === "Num") {
      text += token.v.toString()
      if (token.unit) text += token.unit
    } else if (token.k === "Str") {
      text += `"${token.v}"`
    } else if (token.k === "Sym") {
      text += token.v
    } else if (token.k === "Op") {
      text += token.v
    } else if (token.k === "Pipe") {
      text += "|>"
    } else if (token.k === "DoubleColon") {
      text += "::"
    }
    text += " "
  }
  return text
}

/**
 * Find the current function call and active parameter
 */
function findCurrentFunctionCall(text: string): { name: string; activeParam: number } | null {
  // Simple heuristic: find the last open paren and the function name before it
  let parenDepth = 0
  let lastOpenParen = -1

  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === ')') {
      parenDepth++
    } else if (text[i] === '(') {
      if (parenDepth === 0) {
        lastOpenParen = i
        break
      }
      parenDepth--
    }
  }

  if (lastOpenParen === -1) {
    return null
  }

  // Find function name before the paren
  let nameEnd = lastOpenParen - 1
  while (nameEnd >= 0 && /\s/.test(text[nameEnd])) {
    nameEnd--
  }

  let nameStart = nameEnd
  while (nameStart >= 0 && /[a-zA-Z0-9_]/.test(text[nameStart])) {
    nameStart--
  }
  nameStart++

  const name = text.substring(nameStart, nameEnd + 1)
  if (!name) {
    return null
  }

  // Count commas to determine active parameter
  const argsText = text.substring(lastOpenParen + 1)
  let activeParam = 0
  let depth = 0
  for (const char of argsText) {
    if (char === '(' || char === '{' || char === '[') {
      depth++
    } else if (char === ')' || char === '}' || char === ']') {
      depth--
    } else if (char === ',' && depth === 0) {
      activeParam++
    }
  }

  return { name, activeParam }
}
