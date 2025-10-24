/**
 * AST Utility Tests
 *
 * Tests for AST traversal, querying, and manipulation utilities.
 */

import { describe, test, expect } from "bun:test"
import { parse } from "../../src/kcl-lang/parser"
import {
  traverse,
  findAllVariables,
  findAllFunctions,
  findAllCalls,
  findAllReferences,
  hasExpressionKind,
  countNodes,
  getASTDepth,
  type Visitor
} from "../../src/kcl-lang/ast-utils"

describe("AST Utils: Traverse", () => {
  test("visits all statements", () => {
    const ast = parse(`
let x = 10
let y = 20
let z = 30
    `)

    let stmtCount = 0
    traverse(ast, {
      enterStmt() {
        stmtCount++
      }
    })

    expect(stmtCount).toBe(3)
  })

  test("visits all expressions", () => {
    const ast = parse("let x = 1 + 2 * 3")

    let exprCount = 0
    traverse(ast, {
      enterExpr() {
        exprCount++
      }
    })

    // 1 binary (+), 1 binary (*), 3 numbers = 5
    expect(exprCount).toBeGreaterThanOrEqual(5)
  })

  test("calls exit handlers", () => {
    const ast = parse("let x = 10")

    let entered = 0
    let exited = 0

    traverse(ast, {
      enterStmt() { entered++ },
      exitStmt() { exited++ }
    })

    expect(entered).toBe(exited)
  })

  test("early exit on false return", () => {
    const ast = parse(`
let x = 10
let y = 20
let z = 30
    `)

    let count = 0
    traverse(ast, {
      enterStmt() {
        count++
        if (count === 2) return false // Stop after 2
      }
    })

    expect(count).toBe(2)
  })

  test("traverses nested structures", () => {
    const ast = parse("let nested = {a = {b = {c = 1}}}")

    let objectCount = 0
    traverse(ast, {
      enterExpr(expr) {
        if (expr.kind === "Object") objectCount++
      }
    })

    expect(objectCount).toBe(3)
  })

  test("traverses function body", () => {
    const ast = parse(`
fn test(@x) {
  let y = x + 1
  return y
}
    `)

    let letCount = 0
    traverse(ast, {
      enterStmt(stmt) {
        if (stmt.kind === "Let") letCount++
      }
    })

    expect(letCount).toBe(1)
  })
})

describe("AST Utils: Find Variables", () => {
  test("finds all let bindings", () => {
    const ast = parse(`
let x = 10
let y = 20
let z = 30
    `)

    const vars = findAllVariables(ast)
    expect(vars).toEqual(["x", "y", "z"])
  })

  test("finds assignments", () => {
    const ast = parse(`
x = 10
y = 20
    `)

    const vars = findAllVariables(ast)
    expect(vars).toEqual(["x", "y"])
  })

  test("finds function definitions", () => {
    const ast = parse(`
fn double(@x) { return x * 2 }
fn triple(@x) { return x * 3 }
    `)

    const vars = findAllVariables(ast)
    expect(vars).toEqual(["double", "triple"])
  })

  test("finds mixed definitions", () => {
    const ast = parse(`
let x = 10
fn process(@n) { return n + 1 }
y = 20
    `)

    const vars = findAllVariables(ast)
    expect(vars).toEqual(["x", "process", "y"])
  })

  test("empty program returns empty array", () => {
    const ast = parse("")
    const vars = findAllVariables(ast)
    expect(vars).toEqual([])
  })
})

describe("AST Utils: Find Functions", () => {
  test("finds function definitions with parameters", () => {
    const ast = parse(`
fn double(@x) { return x * 2 }
fn add(@a, @b) { return a + b }
    `)

    const functions = findAllFunctions(ast)
    expect(functions).toHaveLength(2)
    expect(functions[0].name).toBe("double")
    expect(functions[0].params).toHaveLength(1)
    expect(functions[1].name).toBe("add")
    expect(functions[1].params).toHaveLength(2)
  })

  test("finds exported functions", () => {
    const ast = parse("export fn test(@x) { return x }")

    const functions = findAllFunctions(ast)
    // Should find at least one function
    expect(functions.length).toBeGreaterThanOrEqual(1)
    expect(functions.some(f => f.name === "test")).toBe(true)
  })

  test("empty program returns empty array", () => {
    const ast = parse("")
    const functions = findAllFunctions(ast)
    expect(functions).toEqual([])
  })
})

describe("AST Utils: Find Function Calls", () => {
  test("finds function calls", () => {
    const ast = parse(`
let x = double(10)
let y = triple(x)
    `)

    const calls = findAllCalls(ast)
    expect(calls).toEqual(["double", "triple"])
  })

  test("finds nested calls", () => {
    const ast = parse("let result = f(g(h(42)))")

    const calls = findAllCalls(ast)
    expect(calls).toEqual(["f", "g", "h"])
  })

  test("finds calls in pipe", () => {
    const ast = parse("let result = value |> double(%) |> triple(%)")

    const calls = findAllCalls(ast)
    expect(calls).toEqual(["double", "triple"])
  })

  test("empty program returns empty array", () => {
    const ast = parse("")
    const calls = findAllCalls(ast)
    expect(calls).toEqual([])
  })
})

describe("AST Utils: Find References", () => {
  test("finds variable references", () => {
    const ast = parse(`
let x = 10
let y = x + x
    `)

    const refs = findAllReferences(ast)
    expect(refs).toEqual(["x", "x"])
  })

  test("finds references in expressions", () => {
    const ast = parse("let result = a + b * c")

    const refs = findAllReferences(ast)
    expect(refs).toEqual(["a", "b", "c"])
  })

  test("finds references in function calls", () => {
    const ast = parse("let result = process(input)")

    const refs = findAllReferences(ast)
    expect(refs).toEqual(["input"])
  })

  test("distinguishes calls from references", () => {
    const ast = parse("let result = process(input)")

    const refs = findAllReferences(ast)
    const calls = findAllCalls(ast)

    expect(refs).toEqual(["input"])
    expect(calls).toEqual(["process"])
  })
})

describe("AST Utils: Has Expression Kind", () => {
  test("detects pipe expressions", () => {
    const ast = parse("let x = value |> double(%)")
    expect(hasExpressionKind(ast, "Pipe")).toBe(true)
  })

  test("detects array expressions", () => {
    const ast = parse("let x = [1, 2, 3]")
    expect(hasExpressionKind(ast, "Array")).toBe(true)
  })

  test("detects object expressions", () => {
    const ast = parse("let x = {a = 1}")
    expect(hasExpressionKind(ast, "Object")).toBe(true)
  })

  test("returns false when not found", () => {
    const ast = parse("let x = 42")
    expect(hasExpressionKind(ast, "Pipe")).toBe(false)
  })

  test("detects if expressions", () => {
    const ast = parse("let x = if true { 1 } else { 2 }")
    expect(hasExpressionKind(ast, "If")).toBe(true)
  })
})

describe("AST Utils: Count Nodes", () => {
  test("counts number literals", () => {
    const ast = parse("let x = 1 + 2 + 3")
    expect(countNodes(ast, "Number")).toBe(3)
  })

  test("counts binary operations", () => {
    const ast = parse("let x = 1 + 2 * 3 - 4")
    expect(countNodes(ast, "BinaryOp")).toBe(3)
  })

  test("counts let statements", () => {
    const ast = parse(`
let x = 10
let y = 20
let z = 30
    `)
    expect(countNodes(ast, "Let")).toBe(3)
  })

  test("counts function calls", () => {
    const ast = parse("let x = f(g(h(42)))")
    expect(countNodes(ast, "Call")).toBe(3)
  })

  test("zero count for missing node type", () => {
    const ast = parse("let x = 42")
    expect(countNodes(ast, "Pipe")).toBe(0)
  })
})

describe("AST Utils: AST Depth", () => {
  test("simple program has shallow depth", () => {
    const ast = parse("let x = 10")
    const depth = getASTDepth(ast)
    expect(depth).toBeGreaterThan(0)
    expect(depth).toBeLessThan(10)
  })

  test("nested structures increase depth", () => {
    const shallow = parse("let x = 1")
    const deep = parse("let x = {a = {b = {c = {d = 1}}}}")

    const shallowDepth = getASTDepth(shallow)
    const deepDepth = getASTDepth(deep)

    expect(deepDepth).toBeGreaterThan(shallowDepth)
  })

  test("function body adds depth", () => {
    const simple = parse("let x = 10")
    const withFunction = parse(`
fn test(@x) {
  let y = x + 1
  return y
}
    `)

    const simpleDepth = getASTDepth(simple)
    const functionDepth = getASTDepth(withFunction)

    expect(functionDepth).toBeGreaterThan(simpleDepth)
  })

  test("deeply nested calls", () => {
    const ast = parse("let x = f(g(h(i(j(42)))))")
    const depth = getASTDepth(ast)
    // Nested calls should have reasonable depth
    expect(depth).toBeGreaterThanOrEqual(5)
  })
})

describe("AST Utils: Complex Traversals", () => {
  test("collect all identifiers", () => {
    const ast = parse(`
let x = 10
fn double(@n) { return n * 2 }
let y = double(x)
    `)

    const identifiers: string[] = []
    traverse(ast, {
      enterStmt(stmt) {
        if (stmt.kind === "Let" || stmt.kind === "Assign") {
          identifiers.push(stmt.name)
        } else if (stmt.kind === "FnDef") {
          identifiers.push(stmt.name)
          for (const param of stmt.params) {
            identifiers.push(param.name)
          }
        }
      },
      enterExpr(expr) {
        if (expr.kind === "Var") {
          identifiers.push(expr.name)
        } else if (expr.kind === "Call") {
          identifiers.push(expr.callee)
        }
      }
    })

    expect(identifiers).toContain("x")
    expect(identifiers).toContain("double")
    expect(identifiers).toContain("n")
    expect(identifiers).toContain("y")
  })

  test("find all operations", () => {
    const ast = parse("let x = 1 + 2 * 3 - 4 / 2")

    const operations: string[] = []
    traverse(ast, {
      enterExpr(expr) {
        if (expr.kind === "BinaryOp") {
          operations.push(expr.op)
        }
      }
    })

    expect(operations).toContain("+")
    expect(operations).toContain("*")
    expect(operations).toContain("-")
    expect(operations).toContain("/")
  })

  test("validate all numbers are positive", () => {
    const ast = parse("let x = 10 + 20 + 30")

    let allPositive = true
    traverse(ast, {
      enterExpr(expr) {
        if (expr.kind === "Number" && expr.value < 0) {
          allPositive = false
          return false
        }
      }
    })

    expect(allPositive).toBe(true)
  })
})

describe("AST Utils: Edge Cases", () => {
  test("empty program", () => {
    const ast = parse("")

    const vars = findAllVariables(ast)
    const funcs = findAllFunctions(ast)
    const calls = findAllCalls(ast)
    const refs = findAllReferences(ast)

    expect(vars).toEqual([])
    expect(funcs).toEqual([])
    expect(calls).toEqual([])
    expect(refs).toEqual([])
  })

  test("program with only comments", () => {
    const ast = parse("// Just a comment")

    const vars = findAllVariables(ast)
    expect(vars).toEqual([])
  })

  test("traverse handles all expression types", () => {
    // Comprehensive program with many expression types
    const ast = parse(`
let num = 42
let bool = true
let str = "hello"
let arr = [1, 2, 3]
let obj = {a = 1, b = 2}
let neg = -10
let not = !true
let bin = 1 + 2
let call = foo()
let pipe = x |> double(%)
let sub = %
let tag = $myTag
let member = obj.a
let index = arr[0]
let ifExpr = if true { 1 } else { 2 }
    `)

    let exprCount = 0
    traverse(ast, {
      enterExpr() {
        exprCount++
      }
    })

    // Should visit many expressions without errors
    expect(exprCount).toBeGreaterThan(20)
  })
})
