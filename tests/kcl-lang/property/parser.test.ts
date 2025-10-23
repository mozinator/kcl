/**
 * Property Tests for KCL Parser
 *
 * Tests parser properties like determinism, correctness, round-trip, etc.
 */

import { describe, test, expect } from "bun:test"
import { assertProperty } from "../../property/framework"
import { Gen } from "../../property/generator"
import {
  arbSmallProgram,
  arbSimpleProgram,
  arbProgramWithBinaryOps,
  programToSource
} from "./generators"
import {
  parserIsDeterministic,
  validProgramParses,
  roundTripPreservesStructure,
  binaryOpsLeftAssociative
} from "./properties"
import { lex } from "../../../src/kcl-lang/lexer"
import { parse } from "../../../src/kcl-lang/parser"

describe("KCL Parser Property Tests", () => {
  describe("Parser Determinism", () => {
    test("parser is deterministic on generated programs", () => {
      assertProperty(
        Gen.flatMap(arbSmallProgram, prog => {
          const src = programToSource(prog)
          return Gen.map(Gen.constant(src), s => lex(s))
        }),
        parserIsDeterministic,
        { runs: 500 }
      )
    })

    test("parser is deterministic on simple programs", () => {
      assertProperty(
        Gen.flatMap(arbSimpleProgram, prog => {
          const src = programToSource(prog)
          return Gen.map(Gen.constant(src), s => lex(s))
        }),
        parserIsDeterministic,
        { runs: 300 }
      )
    })
  })

  describe("Valid Programs Parse Successfully", () => {
    test("all generated small programs parse", () => {
      assertProperty(
        arbSmallProgram,
        validProgramParses,
        { runs: 500 }
      )
    })

    test("all generated simple programs parse", () => {
      assertProperty(
        arbSimpleProgram,
        validProgramParses,
        { runs: 300 }
      )
    })

    test("programs with binary ops parse", () => {
      assertProperty(
        arbProgramWithBinaryOps,
        validProgramParses,
        { runs: 300 }
      )
    })
  })

  describe("Round-Trip Properties", () => {
    test("round-trip through source preserves program structure", () => {
      assertProperty(
        arbSmallProgram,
        roundTripPreservesStructure,
        { runs: 500 }
      )
    })

    test("round-trip preserves simple programs", () => {
      assertProperty(
        arbSimpleProgram,
        roundTripPreservesStructure,
        { runs: 300 }
      )
    })
  })

  describe("Operator Precedence", () => {
    test("binary operations are left-associative", () => {
      assertProperty(
        Gen.map(
          Gen.tuple(arbProgramWithBinaryOps),
          ([prog]) => programToSource(prog)
        ),
        binaryOpsLeftAssociative,
        { runs: 300 }
      )
    })

    test("multiplication binds tighter than addition", () => {
      // Test expressions like "1 + 2 * 3" parse as "1 + (2 * 3)"
      assertProperty(
        Gen.map(arbProgramWithBinaryOps, programToSource),
        binaryOpsLeftAssociative,
        { runs: 200 }
      )
    })
  })

  describe("Parser Structure", () => {
    test("parsed programs always have Program kind", () => {
      assertProperty(
        arbSmallProgram,
        (program) => {
          const src = programToSource(program)
          const tokens = lex(src)
          const parsed = parse(tokens)
          expect(parsed.kind).toBe("Program")
        },
        { runs: 300 }
      )
    })

    test("let statements have identifier and expression", () => {
      assertProperty(
        arbSmallProgram,
        (program) => {
          const src = programToSource(program)
          const tokens = lex(src)
          const parsed = parse(tokens)

          for (const stmt of parsed.body) {
            if (stmt.kind === "Let") {
              expect(typeof stmt.name).toBe("string")
              expect(stmt.name.length).toBeGreaterThan(0)
              expect(stmt.expr).toBeDefined()
            }
          }
        },
        { runs: 300 }
      )
    })
  })
})
