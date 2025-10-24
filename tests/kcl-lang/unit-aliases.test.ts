/**
 * Unit Aliases Tests
 *
 * Tests for "inch" and "?" unit support
 */

import { describe, test, expect } from "bun:test"
import { lex } from "../../src/kcl-lang/lexer"

describe("Unit Aliases", () => {
  test("inch unit is recognized", () => {
    const { tokens } = lex("let x = 10inch")

    expect(tokens[3].k).toBe("Num")
    expect(tokens[3].unit).toBe("inch")
  })

  test("inch is preferred over in when ambiguous", () => {
    // "10inch" should be parsed as "10" + "inch", not "10in" + "ch"
    const { tokens } = lex("let x = 10inch")

    expect(tokens[3].k).toBe("Num")
    expect(tokens[3].v).toBe(10)
    expect(tokens[3].unit).toBe("inch")
  })

  test("in unit still works", () => {
    const { tokens } = lex("let x = 10in")

    expect(tokens[3].k).toBe("Num")
    expect(tokens[3].unit).toBe("in")
  })

  test("unknown unit marker (?) is recognized", () => {
    const { tokens } = lex("let x = 10?")

    expect(tokens[3].k).toBe("Num")
    expect(tokens[3].unit).toBe("?")
  })

  test("inch doesn't match if followed by identifier characters", () => {
    // "10inches" should be "10" + identifier "inches", not "10inch" + "es"
    const { tokens } = lex("let x = 10inches")

    expect(tokens[3].k).toBe("Num")
    expect(tokens[3].unit).toBeUndefined()
    expect(tokens[4].k).toBe("Ident")
    expect(tokens[4].v).toBe("inches")
  })

  test("all standard units still work", () => {
    const units = ["mm", "cm", "m", "in", "ft", "yd", "deg", "rad", "_"]

    for (const unit of units) {
      const { tokens } = lex(`let x = 10${unit}`)
      expect(tokens[3].unit).toBe(unit)
    }
  })

  test("units are case-sensitive", () => {
    // "MM" should not be recognized as "mm"
    const { tokens } = lex("let x = 10MM")

    expect(tokens[3].k).toBe("Num")
    expect(tokens[3].unit).toBeUndefined()
    expect(tokens[4].k).toBe("Ident")
    expect(tokens[4].v).toBe("MM")
  })
})
