/**
 * Workspace Symbols Tests
 */

import { describe, test, expect } from "bun:test"
import { findWorkspaceSymbols } from "../../src/kcl-lsp/features/workspace-symbols"
import { DocumentManager } from "../../src/kcl-lsp/document-manager"

describe("Workspace Symbols", () => {
  test("finds symbols across multiple documents", () => {
    const manager = new DocumentManager()

    const doc1 = manager.open("file:///project/main.kcl", "fn makeBox(w, h) { return 1 }", 1)
    const doc2 = manager.open("file:///project/utils.kcl", "let width = 10", 1)

    const documents = new Map()
    documents.set("file:///project/main.kcl", doc1)
    documents.set("file:///project/utils.kcl", doc2)

    const results = findWorkspaceSymbols("", documents)

    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results.some(r => r.name === "makeBox")).toBe(true)
    expect(results.some(r => r.name === "width")).toBe(true)
  })

  test("filters by query string (case insensitive)", () => {
    const manager = new DocumentManager()

    const doc = manager.open("file:///test.kcl", `
      fn makeBox(w) { return 1 }
      fn makeCircle(r) { return 2 }
      let width = 10
    `, 1)

    const documents = new Map()
    documents.set("file:///test.kcl", doc)

    const results = findWorkspaceSymbols("box", documents)

    expect(results.some(r => r.name === "makeBox")).toBe(true)
    expect(results.some(r => r.name === "makeCircle")).toBe(false)
    expect(results.some(r => r.name === "width")).toBe(false)
  })

  test("fuzzy matching works", () => {
    const manager = new DocumentManager()

    const doc = manager.open("file:///test.kcl", "fn makeBox(w) { return 1 }", 1)

    const documents = new Map()
    documents.set("file:///test.kcl", doc)

    // "mkbx" should match "makeBox" via fuzzy matching
    const results = findWorkspaceSymbols("mkbx", documents)

    expect(results.some(r => r.name === "makeBox")).toBe(true)
  })

  test("exact matches rank higher", () => {
    const manager = new DocumentManager()

    const doc = manager.open("file:///test.kcl", `
      fn box(w) { return 1 }
      fn makeBox(w) { return 2 }
      fn boxMaker(w) { return 3 }
    `, 1)

    const documents = new Map()
    documents.set("file:///test.kcl", doc)

    const results = findWorkspaceSymbols("box", documents)

    // Exact match should come first
    expect(results[0].name).toBe("box")
  })

  test("prefix matches rank higher than contains", () => {
    const manager = new DocumentManager()

    const doc = manager.open("file:///test.kcl", `
      fn boxMaker(w) { return 1 }
      fn makeBox(w) { return 2 }
    `, 1)

    const documents = new Map()
    documents.set("file:///test.kcl", doc)

    const results = findWorkspaceSymbols("box", documents)

    // Prefix match should come before contains match
    expect(results[0].name).toBe("boxMaker")
  })

  test("respects maxResults limit", () => {
    const manager = new DocumentManager()

    const doc = manager.open("file:///test.kcl", `
      fn func1() { return 1 }
      fn func2() { return 2 }
      fn func3() { return 3 }
    `, 1)

    const documents = new Map()
    documents.set("file:///test.kcl", doc)

    const results = findWorkspaceSymbols("func", documents, 2)

    expect(results.length).toBeLessThanOrEqual(2)
  })

  test("includes container name for nested symbols", () => {
    // For future when we have nested symbols
    // Currently KCL doesn't have nested scopes in the AST representation
    // but this test documents expected behavior
  })

  test("skips documents with parse errors", () => {
    const manager = new DocumentManager()

    const validDoc = manager.open("file:///valid.kcl", "fn box() { return 1 }", 1)
    const invalidDoc = manager.open("file:///invalid.kcl", "fn box(@#$%^", 1)

    const documents = new Map()
    documents.set("file:///valid.kcl", validDoc)
    documents.set("file:///invalid.kcl", invalidDoc)

    const results = findWorkspaceSymbols("box", documents)

    // Should only find symbol from valid document
    expect(results.length).toBe(1)
    expect(results[0].location.uri).toBe("file:///valid.kcl")
  })

  test("empty query returns all symbols", () => {
    const manager = new DocumentManager()

    const doc = manager.open("file:///test.kcl", `
      fn box() { return 1 }
      let width = 10
    `, 1)

    const documents = new Map()
    documents.set("file:///test.kcl", doc)

    const results = findWorkspaceSymbols("", documents)

    expect(results.length).toBeGreaterThanOrEqual(2)
  })
})
