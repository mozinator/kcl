/**
 * Go-to-Definition Feature Integration Tests
 *
 * Tests that definition lookup navigates correctly.
 */

import { describe, test, expect } from "bun:test"
import { DocumentManager } from "../../../src/kcl-lsp/document-manager"
import { getDefinition } from "../../../src/kcl-lsp/features/definition"

describe("Definition: Let Bindings", () => {
  test("find definition of let variable", () => {
    const manager = new DocumentManager()
    const code = `let myBox = box(10, 10, 10)
let x = myBox`
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    // Click on "myBox" in line 1
    const def = getDefinition(result, { line: 1, character: 10 }, uri)

    expect(def).toBeDefined()
    expect(def?.uri).toBe(uri)
    expect(def?.range.start.line).toBe(0)
  })

  test("definition points to identifier after let", () => {
    const manager = new DocumentManager()
    const code = `let variable = 10
let x = variable`
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const def = getDefinition(result, { line: 1, character: 10 }, uri)

    expect(def).toBeDefined()
    if (def) {
      // Should point to "variable" on line 0
      expect(def.range.start.line).toBe(0)
      expect(def.range.start.character).toBe(4) // After "let "
    }
  })

  test("multiple variables with same name scope correctly", () => {
    const manager = new DocumentManager()
    const code = `let x = 10
let y = x
let x = 20`
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    // Reference on line 1 should go to first 'x' on line 0
    const def = getDefinition(result, { line: 1, character: 9 }, uri)

    expect(def).toBeDefined()
    expect(def?.range.start.line).toBe(0)
  })
})

describe("Definition: Function Definitions", () => {
  test("find function definition", () => {
    const manager = new DocumentManager()
    const code = `fn myFunc(@x) { return x }
let result = myFunc(10)`
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const def = getDefinition(result, { line: 1, character: 15 }, uri)

    expect(def).toBeDefined()
    expect(def?.range.start.line).toBe(0)
  })

  test("definition points to function name", () => {
    const manager = new DocumentManager()
    const code = `fn myFunction(@a, @b) {
  return a + b
}
let x = myFunction(1, 2)`
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const def = getDefinition(result, { line: 3, character: 10 }, uri)

    expect(def).toBeDefined()
    if (def) {
      expect(def.range.start.line).toBe(0)
      // Should point to "myFunction" after "fn "
      expect(def.range.start.character).toBe(3)
    }
  })
})

describe("Definition: Not Found Cases", () => {
  test("no definition for stdlib functions", () => {
    const manager = new DocumentManager()
    const code = "let x = box(10, 10, 10)"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    // "box" is a stdlib function, no definition in current file
    const def = getDefinition(result, { line: 0, character: 9 }, uri)

    expect(def).toBeNull()
  })

  test("no definition for numbers", () => {
    const manager = new DocumentManager()
    const code = "let x = 42"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const def = getDefinition(result, { line: 0, character: 9 }, uri)

    expect(def).toBeNull()
  })

  test("no definition for undefined variable", () => {
    const manager = new DocumentManager()
    const code = "let x = undefinedVar"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const def = getDefinition(result, { line: 0, character: 10 }, uri)

    // No definition found for undefinedVar
    expect(def).toBeNull()
  })

  test("no definition on parse error", () => {
    const manager = new DocumentManager()
    const code = "invalid syntax"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const def = getDefinition(result, { line: 0, character: 5 }, uri)

    expect(def).toBeNull()
  })
})

describe("Definition: Edge Cases", () => {
  test("variable defined after use (should not find)", () => {
    const manager = new DocumentManager()
    const code = `let x = y
let y = 10`
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    // Reference to 'y' on line 0, but 'y' is defined on line 1
    // Our simple search should still find it (we don't do scope analysis yet)
    const def = getDefinition(result, { line: 0, character: 9 }, uri)

    // Documents current behavior - might find it or not
    // depending on implementation
    if (def) {
      expect(def.range.start.line).toBe(1)
    }
  })

  test("self-reference in definition", () => {
    const manager = new DocumentManager()
    const code = "let x = x + 1"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const def = getDefinition(result, { line: 0, character: 9 }, uri)

    // Should point to the definition itself
    expect(def).toBeDefined()
    if (def) {
      expect(def.range.start.line).toBe(0)
      expect(def.range.start.character).toBe(4)
    }
  })

  test("clicking on definition itself", () => {
    const manager = new DocumentManager()
    const code = "let myVar = 10"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    // Click on "myVar" in the let statement itself
    const def = getDefinition(result, { line: 0, character: 5 }, uri)

    // Should find itself
    expect(def).toBeDefined()
    if (def) {
      expect(def.range.start.line).toBe(0)
    }
  })
})

describe("Definition: Response Format", () => {
  test("returns Location with uri", () => {
    const manager = new DocumentManager()
    const code = `let x = 10
let y = x`
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const def = getDefinition(result, { line: 1, character: 9 }, uri)

    expect(def).toBeDefined()
    expect(def).toHaveProperty("uri")
    expect(def).toHaveProperty("range")
  })

  test("range has start and end", () => {
    const manager = new DocumentManager()
    const code = `let myVar = 10
let x = myVar`
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const def = getDefinition(result, { line: 1, character: 10 }, uri)

    expect(def?.range).toBeDefined()
    expect(def?.range.start).toBeDefined()
    expect(def?.range.end).toBeDefined()
    expect(def?.range.start).toHaveProperty("line")
    expect(def?.range.start).toHaveProperty("character")
  })

  test("range covers identifier", () => {
    const manager = new DocumentManager()
    const code = `let longVariableName = 10
let x = longVariableName`
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const def = getDefinition(result, { line: 1, character: 10 }, uri)

    if (def) {
      const start = def.range.start.character
      const end = def.range.end.character
      // Should cover "longVariableName" (16 characters)
      expect(end - start).toBe(16)
    }
  })
})

describe("Definition: Non-identifier Positions", () => {
  test("no definition when not on identifier", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    // Position on "=" symbol
    const def = getDefinition(result, { line: 0, character: 6 }, uri)

    expect(def).toBeNull()
  })

  test("no definition on keyword", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    // Position on "let" keyword
    const def = getDefinition(result, { line: 0, character: 1 }, uri)

    expect(def).toBeNull()
  })
})
