/**
 * Deprecated 'let' Keyword Tests
 *
 * Tests that the LSP warns about deprecated 'let' keyword usage.
 */

import { describe, test, expect } from "bun:test"
import { DocumentManager } from "../../../src/kcl-lsp/document-manager"
import { getDiagnostics } from "../../../src/kcl-lsp/features/diagnostics"
import { getCodeActions } from "../../../src/kcl-lsp/features/code-actions"

describe("Deprecated Let Keyword", () => {
  test("warns about let keyword usage", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    const letWarning = diagnostics.find(d => d.source === "kcl-deprecated")
    expect(letWarning).toBeDefined()
    expect(letWarning?.severity).toBe(2) // Warning, not error
    expect(letWarning?.message).toContain("deprecated")
    expect(letWarning?.message).toContain("let")
  })

  test("warning positioned at let keyword", () => {
    const manager = new DocumentManager()
    const code = "let myVar = 42"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    const letWarning = diagnostics.find(d => d.source === "kcl-deprecated")
    if (letWarning) {
      expect(letWarning.range.start.line).toBe(0)
      expect(letWarning.range.start.character).toBe(0)
      expect(letWarning.range.end.character).toBe(3) // 'let' is 3 chars
    }
  })

  test("warns about multiple let usages", () => {
    const manager = new DocumentManager()
    const code = "let x = 10\nlet y = 20\nlet z = 30"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    const letWarnings = diagnostics.filter(d => d.source === "kcl-deprecated")
    expect(letWarnings.length).toBe(3) // One for each 'let'
  })

  test("provides quick fix to remove let keyword", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const diagnostics = getDiagnostics(result)
    const actions = getCodeActions(result, diagnostics[0].range, diagnostics, uri)

    const removeLet = actions.find(a => a.title.includes("Remove deprecated 'let'"))
    expect(removeLet).toBeDefined()
    expect(removeLet?.kind).toBe("quickfix")
  })

  test("quick fix removes let and space", () => {
    const manager = new DocumentManager()
    const code = "let myVar = 42"
    const result = manager.open("file:///test.kcl", code, 1)
    const uri = "file:///test.kcl"

    const diagnostics = getDiagnostics(result)
    const actions = getCodeActions(result, diagnostics[0].range, diagnostics, uri)

    const removeLet = actions.find(a => a.title.includes("Remove deprecated 'let'"))

    if (removeLet?.edit?.changes) {
      const edit = removeLet.edit.changes[uri][0]
      expect(edit.newText).toBe("")
      // Should remove 'let ' (4 characters including space)
      const charLength = edit.range.end.character - edit.range.start.character
      expect(charLength).toBe(4)
    }
  })

  test("no warning for code without let", () => {
    const manager = new DocumentManager()
    const code = "x = 10\ny = 20"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    const letWarnings = diagnostics.filter(d => d.source === "kcl-deprecated")
    expect(letWarnings.length).toBe(0)
  })

  test("warning message is helpful", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    const letWarning = diagnostics.find(d => d.source === "kcl-deprecated")
    if (letWarning) {
      expect(letWarning.message).toContain("direct assignment")
      expect(letWarning.message).toContain("myVar = value")
    }
  })

  test("warning has diagnostic code", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const diagnostics = getDiagnostics(result)

    const letWarning = diagnostics.find(d => d.source === "kcl-deprecated")
    expect(letWarning?.code).toBe("deprecated-let-keyword")
  })
})
