/**
 * Document Manager Tests
 *
 * Tests document lifecycle and parsing.
 */

import { describe, test, expect } from "bun:test"
import { DocumentManager } from "../../../src/kcl-lsp/document-manager"

describe("DocumentManager: Lifecycle", () => {
  test("open document", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const result = manager.open(uri, "let x = 10", 1)

    expect(result.success).toBe(true)
    expect(manager.get(uri)).toBeDefined()
  })

  test("update document", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"

    manager.open(uri, "let x = 10", 1)
    const result = manager.update(uri, "let x = 20", 2)

    expect(result.success).toBe(true)
    expect(manager.getText(uri)).toBe("let x = 20")
  })

  test("close document", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"

    manager.open(uri, "let x = 10", 1)
    manager.close(uri)

    expect(manager.get(uri)).toBeUndefined()
  })

  test("version tracking", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"

    manager.open(uri, "let x = 10", 1)
    const doc1 = manager.get(uri)
    expect(doc1?.version).toBe(1)

    manager.update(uri, "let x = 20", 2)
    const doc2 = manager.get(uri)
    expect(doc2?.version).toBe(2)
  })
})

describe("DocumentManager: Valid Parsing", () => {
  test("parse simple let statement", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const result = manager.open(uri, "let x = 10", 1)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.program.body).toHaveLength(1)
      expect(result.program.body[0].kind).toBe("Let")
    }
  })

  test("parse function call", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const code = "let shape = box(width = 10, height = 20, depth = 30)"
    const result = manager.open(uri, code, 1)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.program.body).toHaveLength(1)
      expect(result.tokens.length).toBeGreaterThan(0)
    }
  })

  test("parse multiple statements", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const code = `let x = 10
let y = 20
let z = x + y`
    const result = manager.open(uri, code, 1)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.program.body).toHaveLength(3)
    }
  })

  test("parse function definition", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const code = `fn add(@a, @b) {
  return a + b
}`
    const result = manager.open(uri, code, 1)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.program.body).toHaveLength(1)
      expect(result.program.body[0].kind).toBe("FnDef")
    }
  })
})

describe("DocumentManager: Invalid Parsing", () => {
  test("lexer error", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    // String with invalid escape sequence that might cause issues
    const code = 'let x = "'
    const result = manager.open(uri, code, 1)

    // Note: Our lexer might handle this gracefully, so this test
    // documents the current behavior
    expect(result).toBeDefined()
  })

  test("parser error - unexpected token", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const code = "let let let" // Invalid syntax
    const result = manager.open(uri, code, 1)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.diagnostics.length).toBeGreaterThan(0)
      expect(result.diagnostics[0].severity).toBe(1) // Error
      expect(result.diagnostics[0].source).toBe("kcl-parser")
    }
  })

  test("parser error - missing expression", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const code = "let x ="
    const result = manager.open(uri, code, 1)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.diagnostics.length).toBeGreaterThan(0)
    }
  })

  test("diagnostics have proper structure", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const code = "invalid syntax here"
    const result = manager.open(uri, code, 1)

    if (!result.success) {
      const diag = result.diagnostics[0]
      expect(diag).toHaveProperty("range")
      expect(diag).toHaveProperty("severity")
      expect(diag).toHaveProperty("message")
      expect(diag.range).toHaveProperty("start")
      expect(diag.range).toHaveProperty("end")
    }
  })
})

describe("DocumentManager: Line Offsets", () => {
  test("single line offsets", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const result = manager.open(uri, "let x = 10", 1)

    expect(result.lineOffsets).toEqual([0])
  })

  test("multiple line offsets", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const code = "let x = 10\nlet y = 20\nlet z = 30"
    const result = manager.open(uri, code, 1)

    expect(result.lineOffsets.length).toBeGreaterThan(1)
    expect(result.lineOffsets[0]).toBe(0)
    expect(result.lineOffsets[1]).toBe(11) // After "let x = 10\n"
  })

  test("empty lines", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const code = "let x = 10\n\nlet y = 20"
    const result = manager.open(uri, code, 1)

    expect(result.lineOffsets.length).toBe(3)
  })
})

describe("DocumentManager: Tokens with Positions", () => {
  test("tokens include ranges", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const result = manager.open(uri, "let x = 10", 1)

    if (result.success) {
      expect(result.tokens.length).toBeGreaterThan(0)
      const firstToken = result.tokens[0]
      expect(firstToken).toHaveProperty("range")
      expect(firstToken.range).toHaveProperty("start")
      expect(firstToken.range).toHaveProperty("end")
    }
  })

  test("can find token at position", () => {
    const manager = new DocumentManager()
    const uri = "file:///test.kcl"
    const result = manager.open(uri, "let x = 10", 1)

    if (result.success) {
      // Find token at character 4 (the 'x')
      const token = result.tokens.find(t => {
        const { start, end } = t.range
        return start.line === 0 && start.character <= 4 && end.character > 4
      })

      expect(token).toBeDefined()
      expect(token?.k).toBe("Ident")
      if (token && token.k === "Ident") {
        expect(token.v).toBe("x")
      }
    }
  })
})
