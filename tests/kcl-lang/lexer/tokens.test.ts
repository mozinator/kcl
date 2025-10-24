/**
 * Lexer Unit Tests - Tokenization
 *
 * Tests that the lexer correctly tokenizes various KCL constructs.
 */

import { describe, test, expect } from "bun:test"
import { lex } from "../../../src/kcl-lang/lexer"

describe("Lexer: Numbers", () => {
  test("integer", () => {
    const { tokens } = lex("42")
    expect(tokens).toContainEqual({ k: "Num", v: 42 })
  })

  test("decimal", () => {
    const { tokens } = lex("3.14")
    expect(tokens).toContainEqual({ k: "Num", v: 3.14 })
  })

  test("negative number", () => {
    const { tokens } = lex("-5")
    expect(tokens).toContainEqual({ k: "Sym", v: "-" })
    expect(tokens).toContainEqual({ k: "Num", v: 5 })
  })
})

describe("Lexer: Identifiers & Keywords", () => {
  test("identifier", () => {
    const { tokens } = lex("foo")
    expect(tokens).toContainEqual({ k: "Ident", v: "foo" })
  })

  test("identifier with underscore", () => {
    const { tokens } = lex("foo_bar")
    expect(tokens).toContainEqual({ k: "Ident", v: "foo_bar" })
  })

  test("keyword: let", () => {
    const { tokens } = lex("let")
    expect(tokens).toContainEqual({ k: "Kw", v: "let" })
  })

  test("keyword: fn", () => {
    const { tokens } = lex("fn")
    expect(tokens).toContainEqual({ k: "Kw", v: "fn" })
  })

  test("keyword: return", () => {
    const { tokens } = lex("return")
    expect(tokens).toContainEqual({ k: "Kw", v: "return" })
  })
})

describe("Lexer: Strings", () => {
  test("simple string", () => {
    const { tokens } = lex('"hello"')
    expect(tokens).toContainEqual({ k: "Str", v: "hello" })
  })

  test("string with spaces", () => {
    const { tokens } = lex('"hello world"')
    expect(tokens).toContainEqual({ k: "Str", v: "hello world" })
  })
})

describe("Lexer: Operators", () => {
  test("arithmetic operators", () => {
    const { tokens } = lex("+ - * / %")
    expect(tokens).toContainEqual({ k: "Sym", v: "+" })
    expect(tokens).toContainEqual({ k: "Sym", v: "-" })
    expect(tokens).toContainEqual({ k: "Sym", v: "*" })
    expect(tokens).toContainEqual({ k: "Sym", v: "/" })
    expect(tokens).toContainEqual({ k: "Sym", v: "%" })
  })

  test("comparison operators", () => {
    const { tokens } = lex("== != < > <= >=")
    expect(tokens).toContainEqual({ k: "Op", v: "==" })
    expect(tokens).toContainEqual({ k: "Op", v: "!=" })
    expect(tokens).toContainEqual({ k: "Sym", v: "<" })
    expect(tokens).toContainEqual({ k: "Sym", v: ">" })
    expect(tokens).toContainEqual({ k: "Op", v: "<=" })
    expect(tokens).toContainEqual({ k: "Op", v: ">=" })
  })

  test("logical operators", () => {
    const { tokens } = lex("& | !")
    expect(tokens).toContainEqual({ k: "Sym", v: "&" })
    expect(tokens).toContainEqual({ k: "Sym", v: "|" })
    expect(tokens).toContainEqual({ k: "Sym", v: "!" })
  })

  test("pipe operator", () => {
    const { tokens } = lex("|>")
    expect(tokens).toContainEqual({ k: "Pipe" })
  })
})

describe("Lexer: Delimiters", () => {
  test("parentheses", () => {
    const { tokens } = lex("( )")
    expect(tokens).toContainEqual({ k: "Sym", v: "(" })
    expect(tokens).toContainEqual({ k: "Sym", v: ")" })
  })

  test("brackets", () => {
    const { tokens } = lex("[ ]")
    expect(tokens).toContainEqual({ k: "Sym", v: "[" })
    expect(tokens).toContainEqual({ k: "Sym", v: "]" })
  })

  test("braces", () => {
    const { tokens } = lex("{ }")
    expect(tokens).toContainEqual({ k: "Sym", v: "{" })
    expect(tokens).toContainEqual({ k: "Sym", v: "}" })
  })
})

describe("Lexer: Comments", () => {
  test("line comment", () => {
    const { tokens } = lex("42 // comment\n 5")
    expect(tokens).toContainEqual({ k: "Num", v: 42 })
    expect(tokens).toContainEqual({ k: "Num", v: 5 })
    expect(tokens).not.toContainEqual(expect.objectContaining({ v: "comment" }))
  })
})
