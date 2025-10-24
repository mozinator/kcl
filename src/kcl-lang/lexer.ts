/**
 * KCL Lexer
 *
 * Tokenizes KCL source code into a stream of tokens and trivia.
 * Trivia includes comments, whitespace, and blank lines for CST support.
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

/**
 * Trivia tokens represent non-code elements (comments, whitespace, newlines)
 */
export type TriviaToken =
  | { type: 'whitespace'; content: string }
  | { type: 'comment'; content: string; isBlock: boolean }
  | { type: 'newline'; count: number }

/**
 * Lexer result with tokens, trivia, and position information
 */
export type LexResult = {
  tokens: Tok[]
  trivia: TriviaToken[]
  positions: number[] // Start position of each token for trivia attachment
}

/**
 * Lex source code into tokens and trivia
 */
export function lex(src: string): LexResult {
  const tokens: Tok[] = []
  const trivia: TriviaToken[] = []
  const positions: number[] = []
  let i = 0

  const isAlpha = (c: string) => /[A-Za-z_]/.test(c)
  const isNum = (c: string) => /[0-9]/.test(c)
  const isWhitespace = (c: string) => /\s/.test(c)
  const isAlphaNum = (c: string) => /[A-Za-z0-9_]/.test(c)

  const captureWhitespace = () => {
    let ws = ''
    let newlineCount = 0

    while (i < src.length && isWhitespace(src[i])) {
      const c = src[i]
      if (c === '\n') {
        newlineCount++
      } else {
        ws += c
      }
      i++
    }

    // Emit whitespace trivia
    if (ws) {
      trivia.push({ type: 'whitespace', content: ws })
    }

    // Emit newline trivia
    if (newlineCount > 0) {
      trivia.push({ type: 'newline', count: newlineCount })
    }
  }

  const captureComment = (): boolean => {
    // Line comment: //
    if (src[i] === '/' && src[i + 1] === '/') {
      let comment = '//'
      i += 2
      while (i < src.length && src[i] !== '\n') {
        comment += src[i++]
      }
      trivia.push({ type: 'comment', content: comment, isBlock: false })

      // Capture the newline after line comment
      if (i < src.length && src[i] === '\n') {
        i++
        trivia.push({ type: 'newline', count: 1 })
      }
      return true
    }

    // Block comment: /* ... */
    if (src[i] === '/' && src[i + 1] === '*') {
      let comment = '/*'
      i += 2

      while (i < src.length) {
        if (src[i] === '*' && src[i + 1] === '/') {
          comment += '*/'
          i += 2
          break
        }
        comment += src[i++]
      }

      trivia.push({ type: 'comment', content: comment, isBlock: true })
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
    if (src[i] === '\n') {
      i++
      trivia.push({ type: 'newline', count: 1 })
    }
  }

  while (i < src.length) {
    // Capture whitespace and comments as trivia
    captureWhitespace()
    if (i >= src.length) break

    if (captureComment()) {
      continue
    }

    // Mark the start position of the next token
    positions.push(trivia.length)

    const c = src[i]

    if (c === '"') {
      tokens.push({ k: "Str", v: readStr() })
      continue
    }

    if (isAlpha(c)) {
      const id = readIdent()
      if (id === "let" || id === "fn" || id === "return" || id === "if" || id === "else") {
        tokens.push({ k: "Kw", v: id as "let" | "fn" | "return" | "if" | "else" })
      } else if (id === "true" || id === "false") {
        tokens.push({ k: "Ident", v: id }) // Boolean keywords handled as identifiers for now
      } else {
        tokens.push({ k: "Ident", v: id })
      }
      continue
    }

    if (isNum(c)) {
      const num = readNum()
      tokens.push({ k: "Num", v: num.value, unit: num.unit })
      continue
    }

    // Multi-character operators
    // Pipe operator |>
    if (c === "|" && src[i + 1] === ">") {
      tokens.push({ k: "Pipe" })
      i += 2
      continue
    }

    // Range operators: .. and ..<
    if (c === "." && src[i + 1] === ".") {
      if (src[i + 2] === "<") {
        tokens.push({ k: "Op", v: "..<" })
        i += 3
      } else {
        tokens.push({ k: "Op", v: ".." })
        i += 2
      }
      continue
    }

    // Comparison and equality operators
    if (c === "=" && src[i + 1] === "=") {
      tokens.push({ k: "Op", v: "==" })
      i += 2
      continue
    }
    if (c === "!" && src[i + 1] === "=") {
      tokens.push({ k: "Op", v: "!=" })
      i += 2
      continue
    }
    if (c === "<" && src[i + 1] === "=") {
      tokens.push({ k: "Op", v: "<=" })
      i += 2
      continue
    }
    if (c === ">" && src[i + 1] === "=") {
      tokens.push({ k: "Op", v: ">=" })
      i += 2
      continue
    }

    // Namespace operator ::
    if (c === ":" && src[i + 1] === ":") {
      tokens.push({ k: "DoubleColon" })
      i += 2
      continue
    }

    // Single character symbols
    tokens.push({ k: "Sym", v: c })
    i++
  }

  // Capture any trailing trivia
  captureWhitespace()

  tokens.push({ k: "EOF" })
  positions.push(trivia.length) // EOF position

  return { tokens, trivia, positions }
}
