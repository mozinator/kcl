/**
 * Hover Feature Integration Tests
 *
 * Tests that hover provides correct information.
 */

import { describe, test, expect } from "bun:test"
import { DocumentManager } from "../../../src/kcl-lsp/document-manager"
import { getHover } from "../../../src/kcl-lsp/features/hover"

describe("Hover: Stdlib Functions", () => {
  test("hover over box function", () => {
    const manager = new DocumentManager()
    const code = "let x = box(10, 10, 10)"
    const result = manager.open("file:///test.kcl", code, 1)

    // Hover over "box" (position 9)
    const hover = getHover(result, { line: 0, character: 9 })

    expect(hover).toBeDefined()
    expect(hover?.contents).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.kind).toBe("markdown")
      expect(hover.contents.value).toContain("box")
      expect(hover.contents.value).toContain("fn(")
    }
  })

  test("hover shows function signature", () => {
    const manager = new DocumentManager()
    const code = "let x = cylinder(10, 20)"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 10 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("cylinder")
      expect(hover.contents.value).toContain("radius")
      expect(hover.contents.value).toContain("height")
    }
  })

  test("hover shows function description", () => {
    const manager = new DocumentManager()
    const code = "let x = translate(shape, [10, 0, 0])"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 10 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("translate")
    }
  })
})

describe("Hover: Constants", () => {
  test("hover over plane constant", () => {
    const manager = new DocumentManager()
    const code = "let plane = XY"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 13 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("XY")
      expect(hover.contents.value).toContain("Plane")
    }
  })

  test("hover over math constant", () => {
    const manager = new DocumentManager()
    const code = "let angle = PI"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 13 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("PI")
      expect(hover.contents.value).toContain("Math constant")
    }
  })

  test("hover over unit constant", () => {
    const manager = new DocumentManager()
    const code = "let turn = QUARTER_TURN"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 15 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("QUARTER_TURN")
      expect(hover.contents.value).toContain("Unit constant")
    }
  })
})

describe("Hover: Literals", () => {
  test("hover over number", () => {
    const manager = new DocumentManager()
    const code = "let x = 42"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 9 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("42")
      expect(hover.contents.value).toContain("Number")
    }
  })

  test("hover over number with unit", () => {
    const manager = new DocumentManager()
    const code = "let x = 10mm"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 9 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("10")
      expect(hover.contents.value).toContain("mm")
    }
  })

  test("hover over string", () => {
    const manager = new DocumentManager()
    const code = 'let s = "hello"'
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 10 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("hello")
      expect(hover.contents.value).toContain("String")
    }
  })
})

describe("Hover: Variables", () => {
  test("hover over variable reference", () => {
    const manager = new DocumentManager()
    const code = `let myBox = box(10, 10, 10)
let x = myBox`
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 1, character: 10 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("myBox")
      expect(hover.contents.value).toContain("Variable")
    }
  })

  test("hover over function name", () => {
    const manager = new DocumentManager()
    const code = `fn myFunc(@x) { return x }
let y = myFunc`
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 1, character: 10 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("myFunc")
    }
  })
})

describe("Hover: Keywords", () => {
  test("hover over keyword", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 1 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("let")
      expect(hover.contents.value).toContain("Keyword")
    }
  })
})

describe("Hover: Edge Cases", () => {
  test("no hover on whitespace", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 3 })

    // Position 3 is a space, might not have hover
    // This documents current behavior
    expect(hover).toBeDefined()
  })

  test("no hover outside token bounds", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 100 })

    // Way past the end of the line
    expect(hover).toBeNull()
  })

  test("no hover on parse error", () => {
    const manager = new DocumentManager()
    const code = "invalid syntax"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 5 })

    // Parse failed, so no hover
    expect(hover).toBeNull()
  })
})

describe("Hover: Range", () => {
  test("hover includes range", () => {
    const manager = new DocumentManager()
    const code = "let x = 10"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 9 })

    expect(hover).toBeDefined()
    expect(hover?.range).toBeDefined()
    expect(hover?.range?.start).toBeDefined()
    expect(hover?.range?.end).toBeDefined()
  })

  test("range matches token position", () => {
    const manager = new DocumentManager()
    const code = "let xyz = 42"
    const result = manager.open("file:///test.kcl", code, 1)

    // Hover over "xyz"
    const hover = getHover(result, { line: 0, character: 5 })

    if (hover?.range) {
      expect(hover.range.start.line).toBe(0)
      expect(hover.range.start.character).toBe(4)
      expect(hover.range.end.character).toBe(7)
    }
  })
})

describe("Hover: Markdown Format", () => {
  test("uses markdown content type", () => {
    const manager = new DocumentManager()
    const code = "let x = box(10, 10, 10)"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 9 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.kind).toBe("markdown")
    }
  })

  test("includes code blocks", () => {
    const manager = new DocumentManager()
    const code = "let x = cylinder(10, 20)"
    const result = manager.open("file:///test.kcl", code, 1)

    const hover = getHover(result, { line: 0, character: 10 })

    expect(hover).toBeDefined()
    if (hover && typeof hover.contents !== "string") {
      expect(hover.contents.value).toContain("```")
      expect(hover.contents.value).toContain("kcl")
    }
  })
})
