/**
 * Lexer with Position Tracking
 *
 * Extended version of the KCL lexer that tracks source positions for LSP.
 */

import type { Position, Range } from "./protocol"
import type { NumericUnit } from "../lexer"

export type TokWithPos =
  | { k: "Ident"; v: string; range: Range }
  | { k: "Num"; v: number; unit?: NumericUnit; range: Range }
  | { k: "Str"; v: string; range: Range }
  | { k: "Sym"; v: string; range: Range }
  | { k: "Pipe"; range: Range }
  | { k: "DoubleColon"; range: Range }
  | { k: "Op"; v: "==" | "!=" | "<=" | ">=" | ".." | "..<"; range: Range }
  | { k: "Kw"; v: "let" | "fn" | "return" | "if" | "else"; range: Range }
  | { k: "EOF"; range: Range }

export function lexWithPositions(src: string): TokWithPos[] {
  const out: TokWithPos[] = []
  let i = 0
  let line = 0
  let character = 0

  const isAlpha = (c: string) => /[A-Za-z_]/.test(c)
  const isNum = (c: string) => /[0-9]/.test(c)
  const isWhitespace = (c: string) => /\s/.test(c)
  const isAlphaNum = (c: string) => /[A-Za-z0-9_]/.test(c)

  const currentPosition = (): Position => ({ line, character })

  const advance = (count = 1) => {
    for (let j = 0; j < count; j++) {
      if (src[i] === '\n') {
        line++
        character = 0
      } else {
        character++
      }
      i++
    }
  }

  const skipWhitespace = () => {
    while (i < src.length && isWhitespace(src[i])) {
      advance()
    }
  }

  const skipComment = () => {
    // Line comment: //
    if (src[i] === '/' && src[i + 1] === '/') {
      advance(2)
      while (i < src.length && src[i] !== '\n') advance()
      if (i < src.length && src[i] === '\n') advance()
      return true
    }

    // Block comment: /* ... */
    if (src[i] === '/' && src[i + 1] === '*') {
      advance(2)
      while (i < src.length) {
        if (src[i] === '*' && src[i + 1] === '/') {
          advance(2)
          return true
        }
        advance()
      }
      return true
    }

    return false
  }

  const readIdent = (start: Position) => {
    let s = ""
    while (i < src.length && isAlphaNum(src[i])) {
      s += src[i]
      advance()
    }
    return { value: s, end: currentPosition() }
  }

  const readNum = (start: Position): { value: number; unit?: NumericUnit; end: Position } => {
    let s = ""
    let hasDot = false
    while (i < src.length) {
      const c = src[i]
      if (isNum(c)) {
        s += c
        advance()
      } else if (c === '.' && !hasDot && i + 1 < src.length && isNum(src[i + 1])) {
        s += c
        advance()
        hasDot = true
      } else {
        break
      }
    }

    const value = parseFloat(s)

    // Check for unit suffix
    const unitSuffixes: NumericUnit[] = ["mm", "cm", "m", "in", "ft", "yd", "deg", "rad", "_"]
    for (const unit of unitSuffixes) {
      if (src.substring(i, i + unit.length) === unit) {
        const nextChar = src[i + unit.length]
        if (!nextChar || !isAlphaNum(nextChar)) {
          advance(unit.length)
          return { value, unit, end: currentPosition() }
        }
      }
    }

    return { value, end: currentPosition() }
  }

  const readString = (start: Position) => {
    const quote = src[i]
    advance() // skip opening quote
    let s = ""
    while (i < src.length && src[i] !== quote) {
      if (src[i] === '\\' && i + 1 < src.length) {
        advance()
        const escaped = src[i]
        s += { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" }[escaped] ?? escaped
      } else {
        s += src[i]
      }
      advance()
    }
    if (i < src.length) advance() // skip closing quote
    return { value: s, end: currentPosition() }
  }

  while (i < src.length) {
    skipWhitespace()
    if (i >= src.length) break

    if (skipComment()) continue

    const start = currentPosition()
    const c = src[i]

    // Numbers
    if (isNum(c)) {
      const { value, unit, end } = readNum(start)
      out.push({ k: "Num", v: value, unit, range: { start, end } })
      continue
    }

    // Identifiers and keywords
    if (isAlpha(c)) {
      const { value, end } = readIdent(start)
      const kws = ["let", "fn", "return", "if", "else"]
      if (kws.includes(value)) {
        out.push({ k: "Kw", v: value as any, range: { start, end } })
      } else {
        out.push({ k: "Ident", v: value, range: { start, end } })
      }
      continue
    }

    // Strings
    if (c === '"' || c === "'") {
      const { value, end } = readString(start)
      out.push({ k: "Str", v: value, range: { start, end } })
      continue
    }

    // Multi-character operators
    if (c === '|' && src[i + 1] === '>') {
      advance(2)
      out.push({ k: "Pipe", range: { start, end: currentPosition() } })
      continue
    }

    if (c === ':' && src[i + 1] === ':') {
      advance(2)
      out.push({ k: "DoubleColon", range: { start, end: currentPosition() } })
      continue
    }

    const twoCharOps: Array<"==" | "!=" | "<=" | ">=" | ".." | "..<"> = ["==", "!=", "<=", ">=", "..", "..<"]
    const twoChar = src.substring(i, i + 2)
    if (twoCharOps.includes(twoChar as any)) {
      advance(2)
      out.push({ k: "Op", v: twoChar as any, range: { start, end: currentPosition() } })
      continue
    }

    // Single-character symbols
    advance()
    out.push({ k: "Sym", v: c, range: { start, end: currentPosition() } })
  }

  const eofPos = currentPosition()
  out.push({ k: "EOF", range: { start: eofPos, end: eofPos } })
  return out
}
