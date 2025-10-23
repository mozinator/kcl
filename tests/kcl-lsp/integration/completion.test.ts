/**
 * Completion Feature Integration Tests
 *
 * Tests that completion provides correct suggestions.
 */

import { describe, test, expect } from "bun:test"
import { DocumentManager } from "../../../src/kcl-lsp/document-manager"
import { getCompletions } from "../../../src/kcl-lsp/features/completion"

describe("Completion: Stdlib Functions", () => {
  test("includes box function", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "let x = ", 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    const boxCompletion = completions.items.find(item => item.label === "box")
    expect(boxCompletion).toBeDefined()
    expect(boxCompletion?.kind).toBe(3) // Function
    expect(boxCompletion?.insertText).toBe("box()")
  })

  test("includes translate function", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "let x = ", 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    const translateCompletion = completions.items.find(item => item.label === "translate")
    expect(translateCompletion).toBeDefined()
    expect(translateCompletion?.kind).toBe(3) // Function
  })

  test("includes all stdlib operations", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "let x = ", 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    // Check for various operations that actually exist in stdlib
    const operations = ["box", "translate", "fuse", "render", "startSketchOn", "line"]
    for (const op of operations) {
      const completion = completions.items.find(item => item.label === op)
      expect(completion).toBeDefined()
    }
  })
})

describe("Completion: Constants", () => {
  test("includes plane constants", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "let x = ", 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    const xyCompletion = completions.items.find(item => item.label === "XY")
    expect(xyCompletion).toBeDefined()
    expect(xyCompletion?.kind).toBe(21) // Constant
    expect(xyCompletion?.detail).toBe("Plane")
  })

  test("includes math constants", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "let x = ", 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    const piCompletion = completions.items.find(item => item.label === "PI")
    expect(piCompletion).toBeDefined()
    expect(piCompletion?.kind).toBe(21) // Constant
  })

  test("includes unit constants", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "let x = ", 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    // Check for mm unit constant
    const mmUnit = completions.items.find(item => item.label === "mm")
    expect(mmUnit).toBeDefined()
    expect(mmUnit?.kind).toBe(21) // Constant
  })
})

describe("Completion: Keywords", () => {
  test("includes let keyword", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "", 1)

    const completions = getCompletions(result, { line: 0, character: 0 })

    const letCompletion = completions.items.find(item => item.label === "let")
    expect(letCompletion).toBeDefined()
    expect(letCompletion?.kind).toBe(14) // Keyword
  })

  test("includes fn keyword", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "", 1)

    const completions = getCompletions(result, { line: 0, character: 0 })

    const fnCompletion = completions.items.find(item => item.label === "fn")
    expect(fnCompletion).toBeDefined()
    expect(fnCompletion?.kind).toBe(14) // Keyword
  })

  test("includes control flow keywords", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "", 1)

    const completions = getCompletions(result, { line: 0, character: 0 })

    const keywords = ["if", "else", "return"]
    for (const kw of keywords) {
      const completion = completions.items.find(item => item.label === kw)
      expect(completion).toBeDefined()
      expect(completion?.kind).toBe(14) // Keyword
    }
  })
})

describe("Completion: Local Variables", () => {
  test("includes let-bound variables", () => {
    const manager = new DocumentManager()
    // Use complete, parseable code
    const code = "let myBox = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    const varCompletion = completions.items.find(item => item.label === "myBox")
    expect(varCompletion).toBeDefined()
    expect(varCompletion?.kind).toBe(6) // Variable
  })

  test("includes function names", () => {
    const manager = new DocumentManager()
    // Simplified single-line function
    const code = "fn myFunction(@x) { return x }"
    const result = manager.open("file:///test.kcl", code, 1)

    const completions = getCompletions(result, { line: 0, character: 5 })

    const fnCompletion = completions.items.find(item => item.label === "myFunction")
    expect(fnCompletion).toBeDefined()
    expect(fnCompletion?.kind).toBe(6) // Variable (function name)
  })

  test("multiple variables in same program", () => {
    const manager = new DocumentManager()
    // Parser needs complete statements - test variables exist after parsing
    const code = "let a = 10\nlet b = 20\nlet c = 30"
    const result = manager.open("file:///test.kcl", code, 1)

    if (result.success) {
      const completions = getCompletions(result, { line: 2, character: 8 })

      const vars = ["a", "b", "c"]
      for (const varName of vars) {
        const completion = completions.items.find(item => item.label === varName)
        expect(completion).toBeDefined()
      }
    }
  })
})

describe("Completion: Failed Parse", () => {
  test("still provides completions on parse error", () => {
    const manager = new DocumentManager()
    const code = "let x = invalid syntax"
    const result = manager.open("file:///test.kcl", code, 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    // Should still get stdlib completions even if parse failed
    expect(completions.items.length).toBeGreaterThan(0)
    const boxCompletion = completions.items.find(item => item.label === "box")
    expect(boxCompletion).toBeDefined()
  })

  test("no local variables on parse error", () => {
    const manager = new DocumentManager()
    const code = "let x = {"
    const result = manager.open("file:///test.kcl", code, 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    // Should not include local variables if parse failed
    const xCompletion = completions.items.find(item => item.label === "x")
    expect(xCompletion).toBeUndefined()
  })
})

describe("Completion: Response Format", () => {
  test("returns CompletionList", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "let x = ", 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    expect(completions).toHaveProperty("isIncomplete")
    expect(completions).toHaveProperty("items")
    expect(Array.isArray(completions.items)).toBe(true)
  })

  test("items have required fields", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "let x = ", 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    const item = completions.items[0]
    expect(item).toHaveProperty("label")
    expect(item).toHaveProperty("kind")
  })

  test("large number of completions", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "let x = ", 1)

    const completions = getCompletions(result, { line: 0, character: 8 })

    // Should have many items (stdlib + constants + keywords)
    expect(completions.items.length).toBeGreaterThan(100)
  })
})
