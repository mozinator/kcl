/**
 * Type Checker Tests
 *
 * Tests for validating types of KCL expressions and statements.
 */

import { describe, test, expect } from "bun:test"
import { typecheck } from "../../src/kcl-lang/typecheck"
import type { Program, Expr, Stmt } from "../../src/kcl-lang/ast"

// Helper to create a simple program
function program(...stmts: Stmt[]): Program {
  return { kind: "Program", body: stmts }
}

// Helper to create a let statement
function letStmt(name: string, expr: Expr): Stmt {
  return { kind: "Let", name, expr }
}

// Helper to create an expression statement
function exprStmt(expr: Expr): Stmt {
  return { kind: "ExprStmt", expr }
}

describe("Type Checking: Literals", () => {
  test("number literal", () => {
    const prog = program(
      letStmt("x", { kind: "Number", value: 42 })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("boolean literal", () => {
    const prog = program(
      letStmt("flag", { kind: "Bool", value: true })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("string literal", () => {
    const prog = program(
      letStmt("msg", { kind: "String", value: "hello" })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("nil literal", () => {
    const prog = program(
      letStmt("empty", { kind: "Nil" })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("array of numbers creates Point type", () => {
    const prog = program(
      letStmt("point", {
        kind: "Array",
        elements: [
          { kind: "Number", value: 1 },
          { kind: "Number", value: 2 },
          { kind: "Number", value: 3 }
        ]
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("object literal", () => {
    const prog = program(
      letStmt("obj", {
        kind: "Object",
        fields: {
          x: { kind: "Number", value: 10 },
          y: { kind: "Number", value: 20 }
        }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })
})

describe("Type Checking: Unary Operations", () => {
  test("unary minus on number", () => {
    const prog = program(
      letStmt("x", {
        kind: "UnaryMinus",
        operand: { kind: "Number", value: 42 }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("unary minus on non-scalar throws error", () => {
    const prog = program(
      letStmt("x", {
        kind: "UnaryMinus",
        operand: { kind: "Nil" }
      })
    )
    expect(() => typecheck(prog)).toThrow(/Unary minus requires Scalar/)
  })

  test("logical NOT on boolean", () => {
    const prog = program(
      letStmt("x", {
        kind: "UnaryNot",
        operand: { kind: "Bool", value: true }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("logical NOT on non-scalar throws error", () => {
    const prog = program(
      letStmt("x", {
        kind: "UnaryNot",
        operand: { kind: "Nil" }
      })
    )
    expect(() => typecheck(prog)).toThrow(/Logical NOT requires Scalar/)
  })
})

describe("Type Checking: Binary Operations", () => {
  test("addition of numbers", () => {
    const prog = program(
      letStmt("sum", {
        kind: "BinaryOp",
        op: "+",
        left: { kind: "Number", value: 1 },
        right: { kind: "Number", value: 2 }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("multiplication of numbers", () => {
    const prog = program(
      letStmt("product", {
        kind: "BinaryOp",
        op: "*",
        left: { kind: "Number", value: 3 },
        right: { kind: "Number", value: 4 }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("comparison operators", () => {
    const prog = program(
      letStmt("result", {
        kind: "BinaryOp",
        op: "<",
        left: { kind: "Number", value: 1 },
        right: { kind: "Number", value: 2 }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("logical operators", () => {
    const prog = program(
      letStmt("result", {
        kind: "BinaryOp",
        op: "&",
        left: { kind: "Bool", value: true },
        right: { kind: "Bool", value: false }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("binary op on non-scalar throws error", () => {
    const prog = program(
      letStmt("x", {
        kind: "BinaryOp",
        op: "+",
        left: { kind: "Nil" },
        right: { kind: "Number", value: 1 }
      })
    )
    expect(() => typecheck(prog)).toThrow(/requires Scalar operands/)
  })
})

describe("Type Checking: Unit Compatibility", () => {
  test("adding numbers with same units", () => {
    const prog = program(
      letStmt("sum", {
        kind: "BinaryOp",
        op: "+",
        left: { kind: "Number", value: 10, unit: "mm" },
        right: { kind: "Number", value: 5, unit: "mm" }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("adding numbers with compatible units (mm + cm)", () => {
    const prog = program(
      letStmt("sum", {
        kind: "BinaryOp",
        op: "+",
        left: { kind: "Number", value: 10, unit: "mm" },
        right: { kind: "Number", value: 1, unit: "cm" }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("adding numbers with incompatible units throws error", () => {
    const prog = program(
      letStmt("sum", {
        kind: "BinaryOp",
        op: "+",
        left: { kind: "Number", value: 10, unit: "mm" },
        right: { kind: "Number", value: 45, unit: "deg" }
      })
    )
    expect(() => typecheck(prog)).toThrow(/incompatible units/)
  })

  test("comparing numbers with compatible units", () => {
    const prog = program(
      letStmt("result", {
        kind: "BinaryOp",
        op: "<",
        left: { kind: "Number", value: 10, unit: "mm" },
        right: { kind: "Number", value: 1, unit: "cm" }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("comparing numbers with incompatible units throws error", () => {
    const prog = program(
      letStmt("result", {
        kind: "BinaryOp",
        op: "==",
        left: { kind: "Number", value: 10, unit: "mm" },
        right: { kind: "Number", value: 10, unit: "deg" }
      })
    )
    expect(() => typecheck(prog)).toThrow(/incompatible units/)
  })

  test("multiplying numbers with different units is allowed", () => {
    const prog = program(
      letStmt("area", {
        kind: "BinaryOp",
        op: "*",
        left: { kind: "Number", value: 10, unit: "mm" },
        right: { kind: "Number", value: 5, unit: "mm" }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })
})

describe("Type Checking: Variables", () => {
  test("using defined variable", () => {
    const prog = program(
      letStmt("x", { kind: "Number", value: 42 }),
      letStmt("y", { kind: "Var", name: "x" })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("using undefined variable throws error", () => {
    const prog = program(
      letStmt("y", { kind: "Var", name: "undefined_var" })
    )
    expect(() => typecheck(prog)).toThrow(/Unknown variable/)
  })

  test("using plane constant", () => {
    const prog = program(
      letStmt("plane", { kind: "Var", name: "XY" })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("using math constant", () => {
    const prog = program(
      letStmt("pi", { kind: "Var", name: "PI" })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })
})

describe("Type Checking: Arrays and Indexing", () => {
  test("indexing array", () => {
    const prog = program(
      letStmt("point", {
        kind: "Array",
        elements: [
          { kind: "Number", value: 1 },
          { kind: "Number", value: 2 }
        ]
      }),
      letStmt("x", {
        kind: "Index",
        array: { kind: "Var", name: "point" },
        index: { kind: "Number", value: 0 }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("range expression", () => {
    const prog = program(
      letStmt("range", {
        kind: "Range",
        start: { kind: "Number", value: 1 },
        end: { kind: "Number", value: 10 },
        inclusive: true
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("range with non-scalar start throws error", () => {
    const prog = program(
      letStmt("range", {
        kind: "Range",
        start: { kind: "Nil" },
        end: { kind: "Number", value: 10 },
        inclusive: true
      })
    )
    expect(() => typecheck(prog)).toThrow(/Range start must be Scalar/)
  })
})

describe("Type Checking: Objects and Member Access", () => {
  test("member access on object", () => {
    const prog = program(
      letStmt("obj", {
        kind: "Object",
        fields: {
          x: { kind: "Number", value: 10 }
        }
      }),
      letStmt("value", {
        kind: "MemberAccess",
        object: { kind: "Var", name: "obj" },
        member: "x"
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })
})

describe("Type Checking: Function Calls", () => {
  test("calling stdlib function with correct arguments", () => {
    const prog = program(
      exprStmt({
        kind: "Call",
        callee: "box",
        args: {
          width: { kind: "Number", value: 10, unit: "mm" },
          height: { kind: "Number", value: 20, unit: "mm" },
          depth: { kind: "Number", value: 30, unit: "mm" }
        }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("calling unknown operation throws error", () => {
    const prog = program(
      exprStmt({
        kind: "Call",
        callee: "unknownOp",
        args: {}
      })
    )
    expect(() => typecheck(prog)).toThrow(/Unknown operation/)
  })

  test("missing required argument throws error", () => {
    const prog = program(
      exprStmt({
        kind: "Call",
        callee: "box",
        args: {
          width: { kind: "Number", value: 10, unit: "mm" }
          // Missing height and depth
        }
      })
    )
    expect(() => typecheck(prog)).toThrow(/Missing argument/)
  })

  test("unknown argument throws error", () => {
    const prog = program(
      exprStmt({
        kind: "Call",
        callee: "box",
        args: {
          width: { kind: "Number", value: 10, unit: "mm" },
          height: { kind: "Number", value: 20, unit: "mm" },
          depth: { kind: "Number", value: 30, unit: "mm" },
          unknownArg: { kind: "Number", value: 1 }
        }
      })
    )
    expect(() => typecheck(prog)).toThrow(/Unknown argument/)
  })

  test("fuse with multiple shapes", () => {
    const prog = program(
      letStmt("shape1", {
        kind: "Call",
        callee: "box",
        args: {
          width: { kind: "Number", value: 10, unit: "mm" },
          height: { kind: "Number", value: 10, unit: "mm" },
          depth: { kind: "Number", value: 10, unit: "mm" }
        }
      }),
      letStmt("shape2", {
        kind: "Call",
        callee: "box",
        args: {
          width: { kind: "Number", value: 5, unit: "mm" },
          height: { kind: "Number", value: 5, unit: "mm" },
          depth: { kind: "Number", value: 5, unit: "mm" }
        }
      }),
      letStmt("fused", {
        kind: "Call",
        callee: "fuse",
        args: {
          $0: { kind: "Var", name: "shape1" },
          $1: { kind: "Var", name: "shape2" }
        }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("fuse with less than 2 arguments throws error", () => {
    const prog = program(
      letStmt("shape1", {
        kind: "Call",
        callee: "box",
        args: {
          width: { kind: "Number", value: 10, unit: "mm" },
          height: { kind: "Number", value: 10, unit: "mm" },
          depth: { kind: "Number", value: 10, unit: "mm" }
        }
      }),
      letStmt("fused", {
        kind: "Call",
        callee: "fuse",
        args: {
          $0: { kind: "Var", name: "shape1" }
        }
      })
    )
    expect(() => typecheck(prog)).toThrow(/fuse requires at least 2 arguments/)
  })
})

describe("Type Checking: Pipe Expressions", () => {
  test("piping to function call", () => {
    const prog = program(
      letStmt("result", {
        kind: "Pipe",
        left: {
          kind: "Call",
          callee: "startSketchOn",
          args: {
            plane: { kind: "Var", name: "XY" }
          }
        },
        right: {
          kind: "Call",
          callee: "startProfile",
          args: {
            at: {
              kind: "Array",
              elements: [
                { kind: "Number", value: 10, unit: "mm" },
                { kind: "Number", value: 20, unit: "mm" }
              ]
            }
          }
        }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("pipe type mismatch throws error", () => {
    const prog = program(
      letStmt("result", {
        kind: "Pipe",
        left: { kind: "Number", value: 42 },
        right: {
          kind: "Call",
          callee: "startProfile",
          args: {
            at: {
              kind: "Array",
              elements: [
                { kind: "Number", value: 10, unit: "mm" },
                { kind: "Number", value: 20, unit: "mm" }
              ]
            }
          }
        }
      })
    )
    expect(() => typecheck(prog)).toThrow(/Pipe type mismatch/)
  })

  test("piping to operation with no parameters throws error", () => {
    const prog = program(
      letStmt("result", {
        kind: "Pipe",
        left: { kind: "Var", name: "XY" },
        right: {
          kind: "Call",
          callee: "box",
          args: {
            width: { kind: "Number", value: 10, unit: "mm" },
            height: { kind: "Number", value: 10, unit: "mm" },
            depth: { kind: "Number", value: 10, unit: "mm" }
          }
        }
      })
    )
    // box expects Shape as first param, Plane is not Shape
    expect(() => typecheck(prog)).toThrow()
  })
})

describe("Type Checking: User-Defined Functions", () => {
  test("defining and calling user function", () => {
    const prog = program(
      {
        kind: "FnDef",
        name: "double",
        params: [{ name: "x" }],
        body: [],
        returnExpr: {
          kind: "BinaryOp",
          op: "*",
          left: { kind: "Var", name: "x" },
          right: { kind: "Number", value: 2 }
        }
      },
      letStmt("result", {
        kind: "Call",
        callee: "double",
        args: {
          $0: { kind: "Number", value: 21 }
        }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("calling user function with too few arguments throws error", () => {
    const prog = program(
      {
        kind: "FnDef",
        name: "add",
        params: [{ name: "a" }, { name: "b" }],
        body: [],
        returnExpr: {
          kind: "BinaryOp",
          op: "+",
          left: { kind: "Var", name: "a" },
          right: { kind: "Var", name: "b" }
        }
      },
      letStmt("result", {
        kind: "Call",
        callee: "add",
        args: {
          $0: { kind: "Number", value: 1 }
        }
      })
    )
    expect(() => typecheck(prog)).toThrow(/requires at least 2 arguments/)
  })

  test("function with optional parameter", () => {
    const prog = program(
      {
        kind: "FnDef",
        name: "greet",
        params: [
          { name: "name" },
          { name: "greeting", optional: true, defaultValue: { kind: "String", value: "Hello" } }
        ],
        body: [],
        returnExpr: { kind: "Var", name: "name" }
      },
      letStmt("result", {
        kind: "Call",
        callee: "greet",
        args: {
          $0: { kind: "String", value: "World" }
        }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })
})

describe("Type Checking: If Expressions", () => {
  test("simple if expression", () => {
    const prog = program(
      letStmt("result", {
        kind: "If",
        condition: { kind: "Bool", value: true },
        thenBranch: { kind: "Number", value: 1 },
        elseIfBranches: [],
        elseBranch: { kind: "Number", value: 2 }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("if with non-scalar condition throws error", () => {
    const prog = program(
      letStmt("result", {
        kind: "If",
        condition: { kind: "Nil" },
        thenBranch: { kind: "Number", value: 1 },
        elseIfBranches: [],
        elseBranch: { kind: "Number", value: 2 }
      })
    )
    expect(() => typecheck(prog)).toThrow(/If condition must be/)
  })

  test("if with else-if branches", () => {
    const prog = program(
      letStmt("result", {
        kind: "If",
        condition: {
          kind: "BinaryOp",
          op: ">",
          left: { kind: "Number", value: 10 },
          right: { kind: "Number", value: 5 }
        },
        thenBranch: { kind: "Number", value: 1 },
        elseIfBranches: [
          {
            condition: {
              kind: "BinaryOp",
              op: "==",
              left: { kind: "Number", value: 10 },
              right: { kind: "Number", value: 5 }
            },
            body: { kind: "Number", value: 2 }
          }
        ],
        elseBranch: { kind: "Number", value: 3 }
      })
    )
    expect(() => typecheck(prog)).not.toThrow()
  })
})

describe("Type Checking: Exports", () => {
  test("exporting a let binding", () => {
    const prog = program(
      {
        kind: "Export",
        stmt: {
          kind: "Let",
          name: "x",
          expr: { kind: "Number", value: 42 }
        }
      }
    )
    expect(() => typecheck(prog)).not.toThrow()
  })

  test("exporting a function", () => {
    const prog = program(
      {
        kind: "Export",
        stmt: {
          kind: "FnDef",
          name: "double",
          params: [{ name: "x" }],
          body: [],
          returnExpr: {
            kind: "BinaryOp",
            op: "*",
            left: { kind: "Var", name: "x" },
            right: { kind: "Number", value: 2 }
          }
        }
      }
    )
    expect(() => typecheck(prog)).not.toThrow()
  })
})
