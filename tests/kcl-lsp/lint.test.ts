/**
 * Lint Rules Tests
 */

import { describe, test, expect } from "bun:test"
import { DocumentManager } from "../../src/kcl-lsp/document-manager"
import { LintEngine, createDefaultRules } from "../../src/kcl-lsp/lint/engine"
import { camelCaseRule } from "../../src/kcl-lsp/lint/rules/camel-case"
import { unusedVariableRule } from "../../src/kcl-lsp/lint/rules/unused-variable"
import { noMagicNumbersRule } from "../../src/kcl-lsp/lint/rules/no-magic-numbers"

describe("Lint Framework", () => {
  test("lint engine runs rules and collects diagnostics", () => {
    const manager = new DocumentManager()
    const code = "let my_variable = 10"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([camelCaseRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics[0].message).toContain("camelCase")
  })

  test("lint engine can be disabled", () => {
    const manager = new DocumentManager()
    const code = "let my_variable = 10"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([camelCaseRule], { enabled: false })
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(0)
  })

  test("rules can be individually disabled", () => {
    const manager = new DocumentManager()
    const code = "let my_variable = 10"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([camelCaseRule], {
      enabled: true,
      disabledRules: ["camelCase"]
    })
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(0)
  })

  test("multiple rules can run together", () => {
    const manager = new DocumentManager()
    const code = `
      let my_variable = 10
      let unused = 20
      fn test() { return 1 }
    `
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([camelCaseRule, unusedVariableRule])
    const diagnostics = engine.lint(parseResult)

    // Should have diagnostics from both rules
    expect(diagnostics.length).toBeGreaterThan(0)
  })
})

describe("camelCase Rule", () => {
  test("flags snake_case variable names", () => {
    const manager = new DocumentManager()
    const code = "let my_variable = 10"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([camelCaseRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(1)
    expect(diagnostics[0].message).toContain("my_variable")
    expect(diagnostics[0].message).toContain("camelCase")
    expect(diagnostics[0].severity).toBe(2) // Warning
  })

  test("flags snake_case function names", () => {
    const manager = new DocumentManager()
    const code = "fn my_function(x) { return x }"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([camelCaseRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(1)
    expect(diagnostics[0].message).toContain("my_function")
  })

  test("accepts camelCase names", () => {
    const manager = new DocumentManager()
    const code = `
      let myVariable = 10
      fn myFunction(x) { return x }
    `
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([camelCaseRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(0)
  })

  test("accepts single-letter names", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([camelCaseRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(0)
  })

  test("accepts ALL_CAPS constants", () => {
    const manager = new DocumentManager()
    const code = "let PI = 3.14159"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([camelCaseRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(0)
  })
})

describe("Unused Variable Rule", () => {
  test("flags unused variables", () => {
    const manager = new DocumentManager()
    const code = `
      let unused = 10
      let used = 20
      let result = used + 5
    `
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([unusedVariableRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.some(d => d.message.includes("unused"))).toBe(true)
    expect(diagnostics.filter(d => d.message.includes("unused")).length).toBe(1)
  })

  test("accepts used variables", () => {
    const manager = new DocumentManager()
    const code = `
      let x = 10
      let y = x + 5
      let z = y + x
    `
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([unusedVariableRule])
    const diagnostics = engine.lint(parseResult)

    // z is unused but that's okay for now (it's the last statement)
    // In a real program, exported or top-level vars might be used externally
    expect(diagnostics.filter(d => d.message.includes("x")).length).toBe(0)
    expect(diagnostics.filter(d => d.message.includes("y")).length).toBe(0)
  })

  test("exported variables are not flagged as unused", () => {
    const manager = new DocumentManager()
    const code = "export let width = 10"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([unusedVariableRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(0)
  })
})

describe("No Magic Numbers Rule", () => {
  test("flags magic numbers", () => {
    const manager = new DocumentManager()
    const code = "let area = width * 42"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([noMagicNumbersRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.some(d => d.message.includes("magic number"))).toBe(true)
  })

  test("allows 0, 1, -1", () => {
    const manager = new DocumentManager()
    const code = `
      let zero = 0
      let one = 1
      let minusOne = -1
    `
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([noMagicNumbersRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(0)
  })

  test("allows numbers with units", () => {
    const manager = new DocumentManager()
    const code = "let width = 42mm"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([noMagicNumbersRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(0)
  })

  test("allows numbers in variable declarations", () => {
    const manager = new DocumentManager()
    const code = "let magicNumber = 42"
    const parseResult = manager.open("file:///test.kcl", code, 1)

    const engine = new LintEngine([noMagicNumbersRule])
    const diagnostics = engine.lint(parseResult)

    expect(diagnostics.length).toBe(0)
  })
})

describe("Default Rules", () => {
  test("createDefaultRules returns all standard rules", () => {
    const rules = createDefaultRules()

    expect(rules.length).toBeGreaterThan(0)
    expect(rules.some(r => r.name === "camelCase")).toBe(true)
    expect(rules.some(r => r.name === "unusedVariable")).toBe(true)
  })
})
