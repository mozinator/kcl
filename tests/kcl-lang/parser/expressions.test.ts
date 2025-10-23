/**
 * Parser Unit Tests - Expressions
 *
 * Tests that the parser correctly parses KCL expressions into AST.
 */

import { describe, test, expect } from "bun:test"
import { lex } from "../../../src/kcl-lang/lexer"
import { parse } from "../../../src/kcl-lang/parser"

describe("Parser: Literals", () => {
  test("number literal", () => {
    const ast = parse(lex("42"))
    expect(ast.body).toBeDefined()
    expect(ast.body[0]).toMatchObject({
      kind: "ExprStmt",
      expr: { kind: "Number", value: 42 },
    })
  })

  test("string literal", () => {
    const ast = parse(lex('"hello"'))
    expect(ast.body[0]).toMatchObject({
      kind: "ExprStmt",
      expr: { kind: "String", value: "hello" },
    })
  })

  test("boolean literal: true", () => {
    const ast = parse(lex("true"))
    expect(ast.body[0]).toMatchObject({
      kind: "ExprStmt",
      expr: { kind: "Bool", value: true },
    })
  })

  test("boolean literal: false", () => {
    const ast = parse(lex("false"))
    expect(ast.body[0]).toMatchObject({
      kind: "ExprStmt",
      expr: { kind: "Bool", value: false },
    })
  })
})

describe("Parser: Binary Operations", () => {
  test("addition", () => {
    const ast = parse(lex("3 + 2"))
    expect(ast.body[0]).toMatchObject({
      kind: "ExprStmt",
      expr: {
        kind: "BinaryOp",
        op: "+",
        left: { kind: "Number", value: 3 },
        right: { kind: "Number", value: 2 },
      },
    })
  })

  test("multiplication", () => {
    const ast = parse(lex("4 * 3"))
    expect(ast.body[0]).toMatchObject({
      kind: "ExprStmt",
      expr: {
        kind: "BinaryOp",
        op: "*",
      },
    })
  })

  test("operator precedence: multiplication before addition", () => {
    const ast = parse(lex("3 + 2 * 4"))
    const expr = ast.body[0].expr
    expect(expr.kind).toBe("BinaryOp")
    expect(expr.op).toBe("+")
    expect(expr.right.kind).toBe("BinaryOp")
    expect(expr.right.op).toBe("*")
  })
})

describe("Parser: Array Literals", () => {
  test("empty array", () => {
    const ast = parse(lex("[]"))
    expect(ast.body[0]).toMatchObject({
      kind: "ExprStmt",
      expr: {
        kind: "Array",
        elements: [],
      },
    })
  })

  test("array with numbers", () => {
    const ast = parse(lex("[1, 2, 3]"))
    expect(ast.body[0].expr).toMatchObject({
      kind: "Array",
      elements: [
        { kind: "Number", value: 1 },
        { kind: "Number", value: 2 },
        { kind: "Number", value: 3 },
      ],
    })
  })
})

describe("Parser: Object Literals", () => {
  test("empty object", () => {
    const ast = parse(lex("{}"))
    expect(ast.body[0]).toMatchObject({
      kind: "ExprStmt",
      expr: {
        kind: "Object",
        fields: {},
      },
    })
  })

  test("object with properties", () => {
    const ast = parse(lex("{a = 1, b = 2}"))
    const expr = ast.body[0].expr
    expect(expr.kind).toBe("Object")
    expect(expr.fields.a).toBeDefined()
    expect(expr.fields.b).toBeDefined()
  })
})

describe("Parser: Function Calls", () => {
  test("function call with no args", () => {
    const ast = parse(lex("foo()"))
    expect(ast.body[0]).toMatchObject({
      kind: "ExprStmt",
      expr: {
        kind: "Call",
        callee: "foo",
        args: {},
      },
    })
  })

  test("function call with positional args", () => {
    const ast = parse(lex("add(1, 2)"))
    const expr = ast.body[0].expr
    expect(expr.kind).toBe("Call")
    expect(expr.callee).toBe("add")
    expect(expr.args.$0).toBeDefined()
    expect(expr.args.$1).toBeDefined()
  })

  test("function call with named args", () => {
    const ast = parse(lex("box(width=10, height=20)"))
    const expr = ast.body[0].expr
    expect(expr.kind).toBe("Call")
    expect(expr.args.width).toBeDefined()
    expect(expr.args.height).toBeDefined()
  })
})

describe("Parser: Pipe Expressions", () => {
  test("simple pipe", () => {
    const ast = parse(lex("5 |> double(%)"))
    expect(ast.body[0]).toMatchObject({
      kind: "ExprStmt",
      expr: {
        kind: "Pipe",
        left: { kind: "Number", value: 5 },
        right: { kind: "Call", callee: "double" },
      },
    })
  })

  test("chained pipe", () => {
    const ast = parse(lex("5 |> double(%) |> addTen(%)"))
    const expr = ast.body[0].expr
    expect(expr.kind).toBe("Pipe")
    // Right side is a Pipe containing another Call
    expect(expr.left).toBeDefined()
    expect(expr.right).toBeDefined()
  })
})
