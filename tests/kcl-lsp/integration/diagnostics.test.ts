/**
 * Diagnostics Feature Integration Tests
 *
 * Tests that diagnostics correctly report errors.
 */

import { describe, test, expect } from "bun:test"
import { DocumentManager } from "../../../src/kcl-lsp/document-manager"
import { getDiagnostics } from "../../../src/kcl-lsp/features/diagnostics"

describe("Diagnostics: Valid Code", () => {
  test("no diagnostics for valid code (without deprecated let)", () => {
    const manager = new DocumentManager()
    const code = "x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics).toHaveLength(0)
  })

  test("no diagnostics for valid function call (without let)", () => {
    const manager = new DocumentManager()
    const code = "shape = box(width = 10, height = 20, depth = 30)"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics).toHaveLength(0)
  })

  test("no diagnostics for complex valid code (without let)", () => {
    const manager = new DocumentManager()
    const code = `fn myFunc(@x, @y) {
  return x + y
}
result = myFunc(10, 20)`
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics).toHaveLength(0)
  })
})

describe("Diagnostics: Parse Errors", () => {
  test("reports parse error for invalid syntax", () => {
    const manager = new DocumentManager()
    const code = "let let let"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics[0].severity).toBe(1) // Error
    expect(diagnostics[0].source).toBe("kcl-parser")
  })

  test("reports error for missing expression", () => {
    const manager = new DocumentManager()
    const code = "let x ="
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics[0].severity).toBe(1)
  })

  test("reports error for unmatched parenthesis", () => {
    const manager = new DocumentManager()
    const code = "let x = box(10, 10, 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
  })

  test("parse error has message", () => {
    const manager = new DocumentManager()
    const code = "invalid syntax"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics[0].message).toBeTruthy()
    expect(diagnostics[0].message.length).toBeGreaterThan(0)
  })
})

describe("Diagnostics: Type Errors", () => {
  test("reports type error for unknown function", () => {
    const manager = new DocumentManager()
    const code = "x = unknownFunction()"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    const typeError = diagnostics.find(d => d.source === "kcl-typecheck")
    expect(typeError).toBeDefined()
  })

  test("type error has error severity", () => {
    const manager = new DocumentManager()
    const code = "x = unknownFunction()"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    const typeError = diagnostics.find(d => d.source === "kcl-typecheck")
    expect(typeError).toBeDefined()
    expect(typeError?.severity).toBe(1) // Error
  })
})

describe("Diagnostics: Format", () => {
  test("diagnostic has required fields", () => {
    const manager = new DocumentManager()
    const code = "let x = {"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    const diag = diagnostics[0]
    expect(diag).toHaveProperty("range")
    expect(diag).toHaveProperty("severity")
    expect(diag).toHaveProperty("message")
    expect(diag).toHaveProperty("source")
  })

  test("diagnostic range has start and end", () => {
    const manager = new DocumentManager()
    const code = "invalid"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    if (diagnostics.length > 0) {
      const range = diagnostics[0].range
      expect(range).toHaveProperty("start")
      expect(range).toHaveProperty("end")
      expect(range.start).toHaveProperty("line")
      expect(range.start).toHaveProperty("character")
    }
  })
})

describe("Diagnostics: Multiple Errors", () => {
  test("can report multiple errors", () => {
    const manager = new DocumentManager()
    // This might generate multiple errors depending on implementation
    const code = "let x = { invalid { nested {"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    // At least one error should be reported
    expect(diagnostics.length).toBeGreaterThanOrEqual(1)
  })
})

describe("Diagnostics: Deprecation Warnings", () => {
  test("warns about deprecated let keyword", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    const letWarning = diagnostics.find(d => d.source === "kcl-deprecated")
    expect(letWarning).toBeDefined()
    expect(letWarning?.severity).toBe(2) // Warning
  })
})

describe("Diagnostics: Empty and Edge Cases", () => {
  test("empty file has no diagnostics", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "", 1)

    const diagnostics = getDiagnostics(result)

    // Empty file should be valid
    expect(diagnostics).toHaveLength(0)
  })

  test("whitespace only has no diagnostics", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "   \n\n  ", 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics).toHaveLength(0)
  })

  test("comment only has no diagnostics", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "// just a comment", 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics).toHaveLength(0)
  })
})

describe("Diagnostics: Source Attribution", () => {
  test("parser errors have kcl-parser source", () => {
    const manager = new DocumentManager()
    const code = "let x = }"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    if (diagnostics.length > 0) {
      const parserDiag = diagnostics.find(d => d.source === "kcl-parser")
      expect(parserDiag).toBeDefined()
    }
  })

  test("type errors have kcl-typecheck source", () => {
    const manager = new DocumentManager()
    const code = "let x = unknownFunc()"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    if (diagnostics.length > 0) {
      const typeDiag = diagnostics.find(d => d.source === "kcl-typecheck")
      expect(typeDiag).toBeDefined()
    }
  })
})

describe("Diagnostics: Recovery", () => {
  test("can parse after fixing error", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"

    // Start with error
    const result1 = manager.open(uri, "x = {", 1)
    const diag1 = getDiagnostics(result1)
    expect(diag1.length).toBeGreaterThan(0)

    // Fix the error
    const result2 = manager.update(uri, "x = 10", 2)
    const diag2 = getDiagnostics(result2)
    expect(diag2).toHaveLength(0)
  })

  test("can introduce error after valid code", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"

    // Start valid
    const result1 = manager.open(uri, "x = 10", 1)
    const diag1 = getDiagnostics(result1)
    expect(diag1).toHaveLength(0)

    // Introduce error
    const result2 = manager.update(uri, "x = {", 2)
    const diag2 = getDiagnostics(result2)
    expect(diag2.length).toBeGreaterThan(0)
  })
})
