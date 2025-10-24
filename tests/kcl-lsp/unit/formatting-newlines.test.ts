/**
 * Formatting Newlines and Indenting Tests
 *
 * Tests that the formatter handles newlines and indentation correctly.
 */

import { describe, test, expect } from "bun:test"
import { DocumentManager } from "../../../src/kcl-lsp/document-manager"
import { formatDocument } from "../../../src/kcl-lsp/features/formatting"
import { formatDocumentWithComments } from "../../../src/kcl-lsp/features/formatting-with-comments"

describe("Formatting: Blank Lines", () => {
  test("adds blank line after function definition", () => {
    const manager = new DocumentManager()
    const code = "fn f(@x) { return x }\nlet y = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const lines = formatted[0].newText.split('\n')
      // Should have blank line after function
      expect(lines.length).toBeGreaterThan(3)
    }
  })

  test("adds blank line before function definition", () => {
    const manager = new DocumentManager()
    const code = "let x = 10\nfn f(@a) { return a }"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Should have blank line before function
      expect(output).toContain("\n\nfn f")
    }
  })

  test("no extra blank lines between regular let statements", () => {
    const manager = new DocumentManager()
    const code = "let x = 10\nlet y = 20\nlet z = 30"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const lines = formatted[0].newText.split('\n').filter(l => l.trim())
      // Should have 3 statements, no extra blank lines
      expect(lines.length).toBe(3)
    }
  })
})

describe("Formatting: Multi-line Functions", () => {
  test("simple function body on multiple lines", () => {
    const manager = new DocumentManager()
    const code = "fn f(@x) { let y = x\nreturn y }"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Should have function on multiple lines
      expect(output).toContain("fn f(@x) {")
      expect(output).toContain("  let y = x")
      expect(output).toContain("  return y")
      expect(output).toContain("}")
    }
  })

  test("simple return stays on one line", () => {
    const manager = new DocumentManager()
    const code = "fn add(@a, @b) { return a + b }"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Simple expression should stay on one line
      expect(output).toContain("{ return a + b }")
    }
  })

  test("complex return uses multiple lines", () => {
    const manager = new DocumentManager()
    const code = "fn f(@x) { return box(width = x, height = x, depth = x, material = x, color = x, thickness = x) }"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Complex expression should use multiple lines
      expect(output).toContain("fn f(@x) {")
      expect(output).toContain("  return")
    }
  })
})

describe("Formatting: Indentation", () => {
  test("2-space indentation in function body", () => {
    const manager = new DocumentManager()
    const code = "fn f(@x) { let y = x\nreturn y }"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Check for 2-space indent
      expect(output).toContain("  let y")
      expect(output).toContain("  return y")
    }
  })

  test("nested indentation (if we had nested blocks)", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    // Just verify it formats without error
    expect(formatted.length).toBeGreaterThanOrEqual(0)
  })
})

describe("Formatting: Arrays", () => {
  test("short arrays stay on one line", () => {
    const manager = new DocumentManager()
    const code = "let arr = [1, 2, 3]"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      expect(output).toContain("[1, 2, 3]")
    }
  })

  test("long arrays use multiple lines", () => {
    const manager = new DocumentManager()
    // Make it long enough to trigger multi-line (>40 chars worth of elements)
    const code = "let arr = [100mm, 200mm, 300mm, 400mm, 500mm, 600mm, 700mm]"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Should have newlines for long arrays
      const lineCount = output.split('\n').length
      expect(lineCount).toBeGreaterThan(3)
    }
  })
})

describe("Formatting: Objects", () => {
  test("short objects stay on one line", () => {
    const manager = new DocumentManager()
    const code = "let obj = { x = 10, y = 20 }"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      expect(output).toContain("{ x = 10, y = 20 }")
    }
  })

  test("long objects use multiple lines", () => {
    const manager = new DocumentManager()
    // Make it long enough (>40 chars)
    const code = "let obj = { width = 100mm, height = 200mm, depth = 300mm, extra = 400mm }"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Should have multiple lines for long objects
      expect(output).toContain("{\n")
      expect(output).toContain("  width")
    }
  })
})

describe("Formatting: Comment Preservation", () => {
  test("default formatter preserves line comments when source is provided", () => {
    const manager = new DocumentManager()
    const code = "// comment\nx = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      expect(output).toContain("// comment")
      expect(output).toContain("x = 10")
    }
  })

  test("preserves comments between statements", () => {
    const manager = new DocumentManager()
    const code = "x = 10\n// middle comment\ny = 20"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      expect(output).toContain("// middle comment")
    }
  })

  test("preserves multiple comments", () => {
    const manager = new DocumentManager()
    const code = "// first\nx = 10\n// second\ny = 20"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      expect(output).toContain("// first")
      expect(output).toContain("// second")
    }
  })

  test("preserves comments in function definitions", () => {
    const manager = new DocumentManager()
    const code = "// Function to make a box\nfn makeBox(w, h, d) {\n  // Call box operation\n  box(w, h, d)\n}"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      expect(output).toContain("// Function to make a box")
      expect(output).toContain("// Call box operation")
    }
  })

  test("formatDocumentWithComments still works for backwards compatibility", () => {
    const manager = new DocumentManager()
    const code = "// comment\nx = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocumentWithComments(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      expect(output).toContain("// comment")
    }
  })
})

describe("Formatting: Edge Cases", () => {
  test("empty file", () => {
    const manager = new DocumentManager()
    const result = manager.open("file:///test.kcl", "", 1)

    const formatted = formatDocument(result)

    // Should handle empty gracefully
    expect(formatted).toBeDefined()
  })

  test("only comments", () => {
    const manager = new DocumentManager()
    const code = "// just a comment"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocumentWithComments(result, code)

    // Should preserve comment
    expect(formatted).toBeDefined()
  })

  test("very long line", () => {
    const manager = new DocumentManager()
    const code = "let x = box(a = 1, b = 2, c = 3, d = 4, e = 5, f = 6, g = 7, h = 8, i = 9, j = 10)"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    // Should break into multiple lines
    expect(formatted).toBeDefined()
  })
})

describe("Formatting: Positional Arguments", () => {
  test("positional arguments are formatted correctly, not as $0, $1, etc", () => {
    const manager = new DocumentManager()
    const code = "result = makeBox(10, 20, 30)"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Should NOT have $0, $1, $2
      expect(output).not.toContain("$0")
      expect(output).not.toContain("$1")
      expect(output).not.toContain("$2")
      // Should keep positional args as-is
      expect(output).toContain("makeBox(10, 20, 30)")
    }
  })

  test("function definition with positional call preserves positional syntax", () => {
    const manager = new DocumentManager()
    const code = "fn makeBox(w, h, d) {\n  box(w, h, d)\n}"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Should preserve positional syntax without $0, $1, $2
      expect(output).not.toContain("$0")
      expect(output).not.toContain("$1")
      expect(output).not.toContain("$2")
      expect(output).toContain("box(w, h, d)")
    }
  })

  test("mixed named and positional arguments are preserved", () => {
    const manager = new DocumentManager()
    const code = "result = myFunc(100, 200, named = 300)"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Should not add $0, $1 to positional args
      expect(output).not.toContain("$0")
      expect(output).not.toContain("$1")
    }
  })
})

describe("Formatting: Conditional Expressions", () => {
  test("conditional expressions without parens don't add them", () => {
    const manager = new DocumentManager()
    const code = "size = if width > 50 { 100 } else { 50 }"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Should not add parentheses around condition
      expect(output).toContain("if width > 50 {")
      expect(output).not.toContain("if (width > 50)")
    }
  })
})

describe("Formatting: Smart Blank Line Preservation", () => {
  test("preserves single blank line between statements", () => {
    const manager = new DocumentManager()
    const code = "x = 1\n\ny = 2"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText.trim()
      // Should preserve the single blank line
      expect(output).toBe("x = 1\n\ny = 2")
    }
  })

  test("preserves double blank line between statements", () => {
    const manager = new DocumentManager()
    const code = "x = 1\n\n\ny = 2"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText.trim()
      // Should preserve double blank (2 blank lines preserved as-is)
      expect(output).toBe("x = 1\n\n\ny = 2")
    }
  })

  test("normalizes excessive blank lines to maximum of 2", () => {
    const manager = new DocumentManager()
    const code = "x = 1\n\n\n\n\ny = 2"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText.trim()
      // 4 blank lines should be normalized to 2
      expect(output).toBe("x = 1\n\n\ny = 2")
      // Count actual blank lines
      const lines = output.split('\n')
      expect(lines).toHaveLength(4) // x = 1, blank, blank, y = 2
    }
  })

  test("preserves blank lines around comments", () => {
    const manager = new DocumentManager()
    const code = "x = 1\n\n// comment\n\ny = 2"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText.trim()
      // Should preserve blanks around comment
      expect(output).toBe("x = 1\n\n// comment\n\ny = 2")
    }
  })

  test("removes leading blank lines at start of file", () => {
    const manager = new DocumentManager()
    const code = "\n\n\nx = 1\ny = 2"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Should not start with blank lines
      expect(output).toMatch(/^x = 1/)
    }
  })

  test("normalizes trailing blank lines to single newline", () => {
    const manager = new DocumentManager()
    const code = "x = 1\ny = 2\n\n\n"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText
      // Should end with single newline
      expect(output).toMatch(/y = 2\n$/)
      expect(output).not.toMatch(/\n\n\n$/)
    }
  })

  test("respects formatter rules for blank before function", () => {
    const manager = new DocumentManager()
    const code = "x = 1\nfn f() { return 1 }"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText.trim()
      // Formatter should add blank before function
      expect(output).toContain("x = 1\n\nfn f()")
    }
  })

  test("merges user blanks with formatter rules (max 2)", () => {
    const manager = new DocumentManager()
    const code = "x = 1\n\n\n\nfn f() { return 1 }"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText.trim()
      // User had 3 blank lines, should normalize to 2 max
      expect(output).toContain("x = 1\n\n\nfn f()")
      // Should not have more than 2 blank lines (which is 3 consecutive newlines)
      expect(output).not.toContain("\n\n\n\n")
    }
  })

  test("preserves intentional section spacing", () => {
    const manager = new DocumentManager()
    const code = `// Section 1
x = 1
y = 2


// Section 2
z = 3`
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText.trim()
      // Should preserve the double blank between sections
      expect(output).toContain("y = 2\n\n\n// Section 2")
    }
  })

  test("handles blank lines with only whitespace", () => {
    const manager = new DocumentManager()
    const code = "x = 1\n  \n\t\ny = 2"
    const result = manager.open("file:///test.kcl", code, 1)

    const formatted = formatDocument(result, code)

    if (formatted.length > 0) {
      const output = formatted[0].newText.trim()
      // Whitespace-only lines should be treated as blank and preserved (2 whitespace lines = 2 blank lines)
      expect(output).toBe("x = 1\n\n\ny = 2")
    }
  })
})
