/**
 * KCL Lexer
 *
 * Tokenizes KCL source code into a stream of tokens.
 * Handles identifiers, numbers, strings, symbols, and keywords.
 */

export type NumericUnit = "mm" | "cm" | "m" | "in" | "ft" | "yd" | "deg" | "rad" | "_"

export type Tok =
  | { k: "Ident"; v: string }
  | { k: "Num"; v: number; unit?: NumericUnit }
  | { k: "Str"; v: string }
  | { k: "Sym"; v: string }
  | { k: "Pipe" } // |> operator
  | { k: "DoubleColon" } // :: operator (namespace separator)
  | { k: "Op"; v: "==" | "!=" | "<=" | ">=" | ".." | "..<" } // Multi-char operators
  | { k: "Kw"; v: "let" | "fn" | "return" | "if" | "else" }
  | { k: "EOF" }

export function lex(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0

  const isAlpha = (c: string) => /[A-Za-z_]/.test(c)
  const isNum = (c: string) => /[0-9]/.test(c)
  const isWhitespace = (c: string) => /\s/.test(c)
  const isAlphaNum = (c: string) => /[A-Za-z0-9_]/.test(c)

  const skipWhitespace = () => {
    while (i < src.length && isWhitespace(src[i])) i++
  }

  const skipComment = () => {
    // Line comment: //
    if (src[i] === '/' && src[i + 1] === '/') {
      i += 2
      while (i < src.length && src[i] !== '\n') i++
      if (i < src.length && src[i] === '\n') i++ // skip the newline
      return true
    }

    // Block comment: /* ... */
    if (src[i] === '/' && src[i + 1] === '*') {
      i += 2 // skip /*
      while (i < src.length) {
        if (src[i] === '*' && src[i + 1] === '/') {
          i += 2 // skip */
          return true
        }
        i++
      }
      // Unterminated block comment - treat as comment to EOF
      return true
    }

    return false
  }

  const readIdent = () => {
    let s = ""
    while (i < src.length && isAlphaNum(src[i])) {
      s += src[i++]
    }
    return s
  }

  const readNum = (): { value: number; unit?: NumericUnit } => {
    let s = ""
    let hasDot = false
    while (i < src.length) {
      const c = src[i]
      if (isNum(c)) {
        s += c
        i++
      } else if (c === '.' && !hasDot && i + 1 < src.length && isNum(src[i + 1])) {
        // Only consume '.' if it's followed by a digit (to avoid consuming '..' operator)
        s += c
        i++
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
        // Make sure it's not part of an identifier (e.g., "42mm" but not "42mmx")
        const nextChar = src[i + unit.length]
        if (!nextChar || !isAlphaNum(nextChar)) {
          i += unit.length
          return { value, unit }
        }
      }
    }

    return { value }
  }

  const readStr = () => {
    i++ // skip opening quote
    let s = ""
    while (i < src.length && src[i] !== '"') {
      s += src[i++]
    }
    if (i < src.length) i++ // skip closing quote
    return s
  }

  // Skip shebang line if present (#!/usr/bin/env kcl)
  if (src.startsWith("#!")) {
    while (i < src.length && src[i] !== '\n') i++
    if (src[i] === '\n') i++
  }

  while (i < src.length) {
    skipWhitespace()
    if (i >= src.length) break

    // Try to skip comment
    if (skipComment()) {
      continue
    }

    const c = src[i]

    if (c === '"') {
      out.push({ k: "Str", v: readStr() })
      continue
    }

    if (isAlpha(c)) {
      const id = readIdent()
      if (id === "let" || id === "fn" || id === "return" || id === "if" || id === "else") {
        out.push({ k: "Kw", v: id as "let" | "fn" | "return" | "if" | "else" })
      } else if (id === "true" || id === "false") {
        out.push({ k: "Ident", v: id }) // Boolean keywords handled as identifiers for now
      } else {
        out.push({ k: "Ident", v: id })
      }
      continue
    }

    if (isNum(c)) {
      const num = readNum()
      out.push({ k: "Num", v: num.value, unit: num.unit })
      continue
    }

    // Multi-character operators
    // Pipe operator |>
    if (c === "|" && src[i + 1] === ">") {
      out.push({ k: "Pipe" })
      i += 2
      continue
    }

    // Range operators: .. and ..<
    if (c === "." && src[i + 1] === ".") {
      if (src[i + 2] === "<") {
        out.push({ k: "Op", v: "..<" })
        i += 3
      } else {
        out.push({ k: "Op", v: ".." })
        i += 2
      }
      continue
    }

    // Comparison and equality operators
    if (c === "=" && src[i + 1] === "=") {
      out.push({ k: "Op", v: "==" })
      i += 2
      continue
    }
    if (c === "!" && src[i + 1] === "=") {
      out.push({ k: "Op", v: "!=" })
      i += 2
      continue
    }
    if (c === "<" && src[i + 1] === "=") {
      out.push({ k: "Op", v: "<=" })
      i += 2
      continue
    }
    if (c === ">" && src[i + 1] === "=") {
      out.push({ k: "Op", v: ">=" })
      i += 2
      continue
    }

    // Namespace operator ::
    if (c === ":" && src[i + 1] === ":") {
      out.push({ k: "DoubleColon" })
      i += 2
      continue
    }

    // Single character symbols
    out.push({ k: "Sym", v: c })
    i++
  }

  out.push({ k: "EOF" })
  return out
}
