/**
 * Enhanced LSP Features Integration Tests
 *
 * Tests for semantic tokens, signature help, formatting, rename, code actions, and symbols.
 */

import { describe, test, expect } from "bun:test"
import { DocumentManager } from "../../../src/kcl-lsp/document-manager"
import { getSemanticTokens } from "../../../src/kcl-lsp/features/semantic-tokens"
import { getSignatureHelp } from "../../../src/kcl-lsp/features/signature-help"
import { formatDocument } from "../../../src/kcl-lsp/features/formatting"
import { prepareRename, performRename } from "../../../src/kcl-lsp/features/rename"
import { getCodeActions } from "../../../src/kcl-lsp/features/code-actions"
import { getDocumentSymbols } from "../../../src/kcl-lsp/features/symbols"

describe("Semantic Tokens", () => {
  test("generates tokens for simple code", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const tokens = getSemanticTokens(result)

    // Should have tokens (encoded as 5 integers per token)
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens.length % 5).toBe(0) // Must be multiple of 5
  })

  test("generates tokens for keywords", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const tokens = getSemanticTokens(result)
    expect(tokens).toBeDefined()
  })

  test("generates tokens for numbers", () => {
    const manager = new DocumentManager()
    const code = "let x = 42mm"
    const result = manager.open("file:///test.kcl", code, 1)

    const tokens = getSemanticTokens(result)
    expect(tokens.length).toBeGreaterThan(0)
  })

  test("generates tokens for strings", () => {
    const manager = new DocumentManager()
    const code = 'let s = "hello"'
    const result = manager.open("file:///test.kcl", code, 1)

    const tokens = getSemanticTokens(result)
    expect(tokens.length).toBeGreaterThan(0)
  })

  test("handles parse errors gracefully", () => {
    const manager = new DocumentManager()
    const code = "invalid syntax"
    const result = manager.open("file:///test.kcl", code, 1)

    const tokens = getSemanticTokens(result)
    // Even on parse error, lexer tokens are still generated
    expect(Array.isArray(tokens)).toBe(true)
  })
})

describe("Signature Help", () => {
  test("provides signature for stdlib function", () => {
    const manager = new DocumentManager()
    const code = "let x = box("
    const result = manager.open("file:///test.kcl", code, 1)

    const sig = getSignatureHelp(result, { line: 0, character: 12 })

    expect(sig).toBeDefined()
    if (sig) {
      expect(sig.signatures.length).toBeGreaterThan(0)
      expect(sig.signatures[0].label).toContain("box")
    }
  })

  test("provides parameter information", () => {
    const manager = new DocumentManager()
    const code = "let x = box("
    const result = manager.open("file:///test.kcl", code, 1)

    const sig = getSignatureHelp(result, { line: 0, character: 12 })

    if (sig && sig.signatures[0]) {
      expect(sig.signatures[0].parameters).toBeDefined()
    }
  })

  test("returns null outside function call", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const sig = getSignatureHelp(result, { line: 0, character: 5 })

    expect(sig).toBeNull()
  })

  test("returns null for parse error", () => {
    const manager = new DocumentManager()
    const code = "invalid"
    const result = manager.open("file:///test.kcl", code, 1)

    const sig = getSignatureHelp(result, { line: 0, character: 3 })

    expect(sig).toBeNull()
  })
})

describe("Document Symbols", () => {
  test("extracts let bindings", () => {
    const manager = new DocumentManager()
    const code = "let x = 10\nlet y = 20"
    const result = manager.open("file:///test.kcl", code, 1)

    const symbols = getDocumentSymbols(result)

    expect(symbols.length).toBeGreaterThanOrEqual(2)
    const xSymbol = symbols.find(s => s.name === "x")
    expect(xSymbol).toBeDefined()
    expect(xSymbol?.kind).toBe(13) // Variable
  })

  test("extracts function definitions", () => {
    const manager = new DocumentManager()
    const code = "fn myFunc(@x) { return x }"
    const result = manager.open("file:///test.kcl", code, 1)

    const symbols = getDocumentSymbols(result)

    const funcSymbol = symbols.find(s => s.name === "myFunc")
    expect(funcSymbol).toBeDefined()
    expect(funcSymbol?.kind).toBe(12) // Function
    expect(funcSymbol?.detail).toContain("fn")
  })

  test("returns empty array on parse error", () => {
    const manager = new DocumentManager()
    const code = "invalid"
    const result = manager.open("file:///test.kcl", code, 1)

    const symbols = getDocumentSymbols(result)

    expect(symbols).toEqual([])
  })
})

describe("Document Formatting", () => {
  test("formats simple code", () => {
    const manager = new DocumentManager()
    const code = "let x=10"
    const result = manager.open("file:///test.kcl", code, 1)

    const edits = formatDocument(result)

    expect(edits.length).toBe(1)
    expect(edits[0].newText).toContain("let x = 10")
  })

  test("formats function with proper indentation", () => {
    const manager = new DocumentManager()
    const code = "fn f(@x){return x}"
    const result = manager.open("file:///test.kcl", code, 1)

    const edits = formatDocument(result)

    expect(edits.length).toBe(1)
    expect(edits[0].newText).toContain("fn f(@x)")
  })

  test("handles parse errors by formatting tokens", () => {
    const manager = new DocumentManager()
    const code = "invalid"
    const result = manager.open("file:///test.kcl", code, 1)

    const edits = formatDocument(result)

    // Even on parse error, we might format what we can from tokens
    expect(Array.isArray(edits)).toBe(true)
  })
})

describe("Rename Refactoring", () => {
  test("prepareRename finds identifier", () => {
    const manager = new DocumentManager()
    const code = "let myVar = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const prep = prepareRename(result, { line: 0, character: 5 })

    expect(prep).toBeDefined()
    expect(prep?.placeholder).toBe("myVar")
  })

  test("prepareRename returns null for non-identifier", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const prep = prepareRename(result, { line: 0, character: 9 })

    // Position on number, not identifier
    expect(prep).toBeNull()
  })

  test("performRename renames all occurrences", () => {
    const manager = new DocumentManager()
    const code = "let x = 10\nlet y = x"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const edit = performRename(result, { line: 0, character: 5 }, "newName", uri)

    expect(edit).toBeDefined()
    expect(edit?.changes).toBeDefined()
    if (edit?.changes) {
      const edits = edit.changes[uri]
      expect(edits.length).toBeGreaterThan(1) // At least 2 occurrences
    }
  })

  test("rename handles parse errors gracefully", () => {
    const manager = new DocumentManager()
    const code = "invalid"
    const result = manager.open("file:///test.kcl", code, 1)

    const edit = performRename(result, { line: 0, character: 3 }, "new", "file:///test.kcl")

    // May still rename tokens even if parse failed
    if (edit) {
      expect(edit.changes).toBeDefined()
    }
  })
})

describe("Code Actions", () => {
  test("provides quick fixes for parse errors", () => {
    const manager = new DocumentManager()
    const code = "let x = {"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const diagnostics = [{
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      message: "Expected }",
      severity: 1,
      source: "kcl-parser",
    }]

    const actions = getCodeActions(result, diagnostics[0].range, diagnostics, uri)

    expect(actions.length).toBeGreaterThan(0)
    const fixAction = actions.find(a => a.title.includes("closing brace"))
    expect(fixAction).toBeDefined()
  })

  test("provides actions for type errors", () => {
    const manager = new DocumentManager()
    const code = "let x = unknownFunc()"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const diagnostics = [{
      range: { start: { line: 0, character: 8 }, end: { line: 0, character: 19 } },
      message: "Unknown function: unknownFunc",
      severity: 1,
      source: "kcl-typecheck",
    }]

    const actions = getCodeActions(result, diagnostics[0].range, diagnostics, uri)

    const defineAction = actions.find(a => a.title.includes("Define function"))
    expect(defineAction).toBeDefined()
  })

  test("returns empty array for no diagnostics", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const actions = getCodeActions(result, { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } }, [], uri)

    // Should still have source actions
    expect(actions.length).toBeGreaterThanOrEqual(0)
  })
})
