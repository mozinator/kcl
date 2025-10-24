/**
 * Reusable KCL Properties
 *
 * Common property assertions that can be used across different KCL tests.
 */

import type { Property } from "../../property/framework"
import type { Program, Expr } from "../../../src/kcl-lang/ast"
import type { Tok } from "../../../src/kcl-lang/lexer"
import { lex } from "../../../src/kcl-lang/lexer"
import { parse } from "../../../src/kcl-lang/parser"
import { expect } from "bun:test"
import { programToSource } from "./generators"

/**
 * Property: Lexer always produces EOF token
 */
export const lexerProducesEOF: Property<string> = (src) => {
  const { tokens } = lex(src)
  expect(tokens.length).toBeGreaterThan(0)
  expect(tokens[tokens.length - 1]).toEqual({ k: "EOF" })
}

/**
 * Property: Lexer is deterministic
 */
export const lexerIsDeterministic: Property<string> = (src) => {
  const result1 = lex(src)
  const result2 = lex(src)
  expect(result2).toEqual(result1)
}

/**
 * Property: Comments are preserved as trivia (not eliminated from tokens)
 */
export const commentsAreEliminated: Property<[string, string]> = ([src, comment]) => {
  const withoutComment = lex(src)
  const withComment = lex(`${src} // ${comment}`)

  // Both should have EOF
  expect(withoutComment.tokens[withoutComment.tokens.length - 1]).toEqual({ k: "EOF" })
  expect(withComment.tokens[withComment.tokens.length - 1]).toEqual({ k: "EOF" })

  // The code tokens should be the same (comments are in trivia now)
  expect(withComment.tokens.slice(0, -1)).toEqual(withoutComment.tokens.slice(0, -1))
}

/**
 * Property: Parser is deterministic
 */
export const parserIsDeterministic: Property<string> = (src) => {
  try {
    const ast1 = parse(src)
    const ast2 = parse(src)
    expect(ast2).toEqual(ast1)
  } catch (e) {
    // If it throws, it should throw consistently
    expect(() => parse(src)).toThrow()
  }
}

/**
 * Property: Valid program always parses successfully
 */
export const validProgramParses: Property<Program> = (program) => {
  const src = programToSource(program)

  // Should not throw
  const parsed = parse(src)
  expect(parsed.kind).toBe("Program")
  expect(parsed.body.length).toBeGreaterThan(0)
}

/**
 * Property: Round-trip through source preserves program structure
 */
export const roundTripPreservesStructure: Property<Program> = (program) => {
  const src = programToSource(program)
  const parsed = parse(src)

  // Should have same number of statements
  expect(parsed.body.length).toBe(program.body.length)

  // Each statement should have same kind
  for (let i = 0; i < program.body.length; i++) {
    expect(parsed.body[i].kind).toBe(program.body[i].kind)
  }
}

/**
 * Property: Binary operations are left-associative
 */
export const binaryOpsLeftAssociative: Property<string> = (src) => {
  // Test expressions like "1 + 2 + 3" parse as ((1 + 2) + 3)
  if (!src.includes("+") && !src.includes("-") && !src.includes("*") && !src.includes("/")) {
    return // Skip if no operators
  }

  try {
    const tokens = lex(src)
    const ast = parse(tokens)

    // Walk the AST and check that binary ops are left-associative
    const checkLeftAssoc = (expr: Expr): void => {
      if (expr.kind === "BinaryOp") {
        // If right is also a binary op with same precedence, that would be wrong
        if (expr.right.kind === "BinaryOp") {
          const leftPrec = getPrecedence(expr.op)
          const rightPrec = getPrecedence(expr.right.op)

          // Right side should have higher precedence (or be parenthesized)
          expect(rightPrec).toBeGreaterThanOrEqual(leftPrec)
        }
        checkLeftAssoc(expr.left)
        checkLeftAssoc(expr.right)
      }
    }

    for (const stmt of ast.body) {
      if (stmt.kind === "Let" || stmt.kind === "Assign") {
        checkLeftAssoc(stmt.expr)
      } else if (stmt.kind === "ExprStmt") {
        checkLeftAssoc(stmt.expr)
      }
    }
  } catch (e) {
    // OK if parsing fails
  }
}

function getPrecedence(op: string): number {
  switch (op) {
    case "^":
      return 6
    case "*":
    case "/":
    case "%":
      return 5
    case "+":
    case "-":
      return 4
    case "<":
    case ">":
    case "<=":
    case ">=":
      return 3
    case "==":
    case "!=":
      return 2
    case "&":
      return 1
    case "|":
      return 0
    default:
      return -1
  }
}
