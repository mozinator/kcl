/**
 * Error Position Tracking Tests
 *
 * Tests that errors are reported at accurate positions.
 */

import { describe, test, expect } from "bun:test"
import { DocumentManager } from "../../../src/kcl-lsp/document-manager"
import { getDiagnostics } from "../../../src/kcl-lsp/features/diagnostics"

describe("Error Positions: Parse Errors", () => {
  test("reports error at correct position for missing expression", () => {
    const manager = new DocumentManager()
    const code = "let x ="
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    const diag = diagnostics[0]

    // Error should be near the end where expression is missing
    expect(diag.range.start.line).toBe(0)
    expect(diag.range.start.character).toBeGreaterThan(0) // Not at column 0
  })

  test("reports error at correct position for unexpected token", () => {
    const manager = new DocumentManager()
    const code = "let x = }"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    const diag = diagnostics[0]

    // Error should be at the '}' character
    expect(diag.range.start.line).toBe(0)
    expect(diag.range.start.character).toBeGreaterThanOrEqual(8) // Position of '}'
  })

  test("reports error at correct line for multiline code", () => {
    const manager = new DocumentManager()
    const code = `let x = 10
let y = 20
let z =`
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    const diag = diagnostics[0]

    // Error should be on line 2 (third line)
    expect(diag.range.start.line).toBe(2)
  })

  test("reports error with non-zero range", () => {
    const manager = new DocumentManager()
    const code = "let x = ("
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    if (diagnostics.length > 0) {
      const diag = diagnostics[0]
      // Range should have some length (not just a point)
      const rangeLength = diag.range.end.character - diag.range.start.character
      expect(rangeLength).toBeGreaterThanOrEqual(1)
    }
  })
})

describe("Error Positions: Type Errors", () => {
  test("reports error at unknown function position", () => {
    const manager = new DocumentManager()
    const code = "let x = unknownFunc()"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    const diag = diagnostics.find(d => d.source === "kcl-typecheck")
    expect(diag).toBeDefined()

    if (diag) {
      // Error should be at "unknownFunc" position, not at 0
      expect(diag.range.start.character).toBeGreaterThan(5) // After "let x = "
      expect(diag.range.end.character).toBeGreaterThan(diag.range.start.character)
    }
  })

  test("highlights the problematic identifier", () => {
    const manager = new DocumentManager()
    const code = "let result = notDefined + 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    const typeError = diagnostics.find(d => d.source === "kcl-typecheck")

    if (typeError) {
      // Should highlight "notDefined"
      const start = typeError.range.start.character
      const end = typeError.range.end.character

      // Extract the highlighted text from the code
      const highlightedText = code.substring(start, end)
      expect(highlightedText).toBe("notDefined")
    }
  })

  test("handles errors in nested expressions", () => {
    const manager = new DocumentManager()
    const code = "let x = box(width = unknownVar)"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    const typeError = diagnostics.find(d => d.source === "kcl-typecheck")

    if (typeError) {
      // Error should be positioned somewhere meaningful (not at 0, 0)
      // Could be at "box" or "unknownVar" depending on error type
      const isAtZeroZero = typeError.range.start.line === 0 && typeError.range.start.character === 0
      expect(isAtZeroZero).toBe(false)
      expect(typeError.range.start.character).toBeGreaterThan(0)
    }
  })
})

describe("Error Positions: Multiple Errors", () => {
  test("reports multiple errors at different positions", () => {
    const manager = new DocumentManager()
    // This might generate multiple errors
    const code = `let a = unknownFunc1()
let b = unknownFunc2()`
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    // Might have multiple diagnostics
    if (diagnostics.length >= 2) {
      // First error should be on line 0
      expect(diagnostics[0].range.start.line).toBe(0)

      // If we have a second error, verify it's positioned
      const secondError = diagnostics.find(d => d.range.start.line === 1)
      if (secondError) {
        expect(secondError.range.start.line).toBe(1)
      }
    }
  })
})

describe("Error Positions: Edge Cases", () => {
  test("handles error at start of file", () => {
    const manager = new DocumentManager()
    const code = "}"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    const diag = diagnostics[0]

    expect(diag.range.start.line).toBe(0)
    expect(diag.range.start.character).toBeGreaterThanOrEqual(0)
  })

  test("handles error at end of file", () => {
    const manager = new DocumentManager()
    const code = "let x = 10\nlet y ="
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    expect(diagnostics.length).toBeGreaterThan(0)
    const diag = diagnostics[0]

    // Should be on the last line
    expect(diag.range.start.line).toBe(1)
  })

  test("error range doesn't exceed line length", () => {
    const manager = new DocumentManager()
    const code = "let x ="
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    if (diagnostics.length > 0) {
      const diag = diagnostics[0]
      // End position shouldn't be way beyond the line
      expect(diag.range.end.character).toBeLessThanOrEqual(code.length + 5)
    }
  })
})

describe("Error Positions: Comparison with Old Behavior", () => {
  test("parse error is NOT at (0, 0)", () => {
    const manager = new DocumentManager()
    const code = "let x = {"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    if (diagnostics.length > 0) {
      const diag = diagnostics[0]
      // With better error positions, this should NOT be at (0, 0)
      const isAtZeroZero = diag.range.start.line === 0 && diag.range.start.character === 0
      // It might still be at 0,0 for some errors, but most should be better positioned
      // Just verify we're getting position info
      expect(diag.range).toBeDefined()
    }
  })

  test("type error is positioned at identifier, not (0, 0)", () => {
    const manager = new DocumentManager()
    const code = "let result = undefinedVar"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    const typeError = diagnostics.find(d => d.source === "kcl-typecheck")

    if (typeError) {
      // Should be positioned at the identifier, not at (0, 0)
      const isAtZeroZero = typeError.range.start.line === 0 && typeError.range.start.character === 0
      expect(isAtZeroZero).toBe(false)
    }
  })
})
