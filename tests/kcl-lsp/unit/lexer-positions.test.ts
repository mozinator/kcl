/**
 * LSP Lexer Position Tracking Tests
 *
 * Tests that the lexer correctly tracks line/character positions for LSP.
 */

import { describe, test, expect } from "bun:test"
import { lexWithPositions } from "../../../src/kcl-lsp/lexer-with-positions"

describe("Lexer Positions: Basic Tokens", () => {
  test("single token position", () => {
    const tokens = lexWithPositions("42")
    expect(tokens).toHaveLength(2) // Number + EOF
    expect(tokens[0]).toMatchObject({
      k: "Num",
      v: 42,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 2 },
      },
    })
  })

  test("multiple tokens on same line", () => {
    const tokens = lexWithPositions("let x = 10")
    expect(tokens[0]).toMatchObject({
      k: "Kw",
      v: "let",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 3 },
      },
    })
    expect(tokens[1]).toMatchObject({
      k: "Ident",
      v: "x",
      range: {
        start: { line: 0, character: 4 },
        end: { line: 0, character: 5 },
      },
    })
  })

  test("multiple lines", () => {
    const tokens = lexWithPositions("let x = 10\nlet y = 20")

    // First line
    expect(tokens[0].range.start).toEqual({ line: 0, character: 0 })

    // Second line
    const secondLet = tokens.find((t, i) => i > 0 && t.k === "Kw" && t.v === "let")
    expect(secondLet?.range.start.line).toBe(1)
    expect(secondLet?.range.start.character).toBe(0)
  })
})

describe("Lexer Positions: Numbers with Units", () => {
  test("number with mm unit", () => {
    const tokens = lexWithPositions("42mm")
    expect(tokens[0]).toMatchObject({
      k: "Num",
      v: 42,
      unit: "mm",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 4 },
      },
    })
  })

  test("decimal with deg unit", () => {
    const tokens = lexWithPositions("90.5deg")
    expect(tokens[0]).toMatchObject({
      k: "Num",
      v: 90.5,
      unit: "deg",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 7 },
      },
    })
  })
})

describe("Lexer Positions: Strings", () => {
  test("string literal position", () => {
    const tokens = lexWithPositions('"hello"')
    expect(tokens[0]).toMatchObject({
      k: "Str",
      v: "hello",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 7 },
      },
    })
  })

  test("string with spaces", () => {
    const tokens = lexWithPositions('"hello world"')
    expect(tokens[0]).toMatchObject({
      k: "Str",
      v: "hello world",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 13 },
      },
    })
  })
})

describe("Lexer Positions: Operators", () => {
  test("pipe operator", () => {
    const tokens = lexWithPositions("x |> y")
    const pipeToken = tokens.find(t => t.k === "Pipe")
    expect(pipeToken?.range).toEqual({
      start: { line: 0, character: 2 },
      end: { line: 0, character: 4 },
    })
  })

  test("double colon", () => {
    const tokens = lexWithPositions("std::PI")
    const colonToken = tokens.find(t => t.k === "DoubleColon")
    expect(colonToken?.range).toEqual({
      start: { line: 0, character: 3 },
      end: { line: 0, character: 5 },
    })
  })

  test("comparison operators", () => {
    const tokens = lexWithPositions("x == y")
    const opToken = tokens.find(t => t.k === "Op" && t.v === "==")
    expect(opToken?.range).toEqual({
      start: { line: 0, character: 2 },
      end: { line: 0, character: 4 },
    })
  })
})

describe("Lexer Positions: Comments", () => {
  test("line comment doesn't produce token", () => {
    const tokens = lexWithPositions("let x = 10 // comment")
    // Should have: let, x, =, 10, EOF
    expect(tokens).toHaveLength(5)
    expect(tokens.every(t => t.k !== "Comment" as any)).toBe(true)
  })

  test("block comment doesn't produce token", () => {
    const tokens = lexWithPositions("let x /* comment */ = 10")
    expect(tokens).toHaveLength(5) // let, x, =, 10, EOF
  })

  test("positions after line comment", () => {
    const tokens = lexWithPositions("let x = 10\n// comment\nlet y = 20")
    const yToken = tokens.find(t => t.k === "Ident" && t.v === "y")
    expect(yToken?.range.start.line).toBe(2)
  })
})

describe("Lexer Positions: Complex Code", () => {
  test("function call with arguments", () => {
    const code = "box(width = 10mm)"
    const tokens = lexWithPositions(code)

    const boxToken = tokens.find(t => t.k === "Ident" && t.v === "box")
    expect(boxToken?.range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 3 },
    })

    const widthToken = tokens.find(t => t.k === "Ident" && t.v === "width")
    expect(widthToken?.range.start.character).toBeGreaterThan(3)
  })

  test("multiline expression", () => {
    const code = `let result = box(
  width = 10mm,
  height = 20mm
)`
    const tokens = lexWithPositions(code)

    const heightToken = tokens.find(t => t.k === "Ident" && t.v === "height")
    expect(heightToken?.range.start.line).toBe(2)
  })
})

describe("Lexer Positions: EOF", () => {
  test("EOF at end of file", () => {
    const tokens = lexWithPositions("let x = 10")
    const eofToken = tokens[tokens.length - 1]
    expect(eofToken.k).toBe("EOF")
    expect(eofToken.range.start.line).toBeGreaterThanOrEqual(0)
  })

  test("EOF position after newline", () => {
    const tokens = lexWithPositions("let x = 10\n")
    const eofToken = tokens[tokens.length - 1]
    expect(eofToken.k).toBe("EOF")
  })
})
