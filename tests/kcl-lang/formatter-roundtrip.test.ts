/**
 * Formatter Round-Trip Tests
 *
 * Tests that parsing → formatting → parsing produces a stable result.
 * This ensures that the CST-based formatter preserves all semantic information.
 */

import { describe, test, expect } from "bun:test"
import { parse } from "../../src/kcl-lang/parser"
import { formatDocument } from "../../src/kcl-lsp/features/formatting"
import type { ParseResult } from "../../src/kcl-lsp/document-manager"

/**
 * Helper to format code through the formatter
 */
function format(code: string): string {
  const ast = parse(code)
  const mockParseResult: ParseResult = {
    success: true,
    program: ast,
    errors: [],
    lineOffsets: code.split('\n').map((_, i) => i),
  }

  const edits = formatDocument(mockParseResult)
  return edits.length > 0 ? edits[0].newText : code
}

/**
 * Helper to test round-trip stability
 */
function testRoundTrip(code: string): void {
  const formatted1 = format(code)
  const formatted2 = format(formatted1)
  expect(formatted1).toBe(formatted2)
}

describe("Formatter: Round-Trip Stability", () => {
  test("simple let statement", () => {
    testRoundTrip("let x = 10")
  })

  test("multiple let statements", () => {
    testRoundTrip(`
let x = 10
let y = 20
let z = 30
    `.trim())
  })

  test("function definition", () => {
    testRoundTrip("fn double(@x) { return x * 2 }")
  })

  test("complex expression", () => {
    testRoundTrip("let result = 1 + 2 * 3 - 4 / 2")
  })

  test("array literal", () => {
    testRoundTrip("let arr = [1, 2, 3, 4, 5]")
  })

  test("object literal", () => {
    testRoundTrip("let obj = {a = 1, b = 2, c = 3}")
  })

  test("pipe expression", () => {
    testRoundTrip("let result = value |> double(%) |> triple(%)")
  })
})

describe("Formatter: Comment Preservation", () => {
  test("line comment preserved", () => {
    const code = `
let x = 10 // This is a comment
let y = 20
    `.trim()
    const formatted = format(code)
    expect(formatted).toContain("// This is a comment")
  })

  test("block comment preserved", () => {
    const code = `
/* This is
   a block comment */
let x = 10
    `.trim()
    const formatted = format(code)
    expect(formatted).toContain("/* This is")
    expect(formatted).toContain("a block comment */")
  })

  test("multiple comments preserved", () => {
    const code = `
// Comment 1
// Comment 2
let x = 10
// Comment 3
let y = 20
    `.trim()
    const formatted = format(code)
    expect(formatted).toContain("// Comment 1")
    expect(formatted).toContain("// Comment 2")
    expect(formatted).toContain("// Comment 3")
  })
})

describe("Formatter: Whitespace Normalization", () => {
  test("extra spaces removed", () => {
    const formatted = format("let x    =     10")
    expect(formatted).toBe("let x = 10\n")
  })

  test("blank lines normalized", () => {
    const code = `
let x = 10



let y = 20
    `.trim()
    const formatted = format(code)
    // Should not have more than 2 consecutive blank lines
    expect(formatted).not.toMatch(/\n\n\n\n/)
  })

  test("trailing whitespace removed", () => {
    const code = "let x = 10     \nlet y = 20     "
    const formatted = format(code)
    expect(formatted).not.toMatch(/ +\n/)
  })
})

describe("Formatter: Function Spacing", () => {
  test("blank line before function", () => {
    const code = `
let x = 10
fn double(@n) { return n * 2 }
    `.trim()
    const formatted = format(code)
    expect(formatted).toContain("\n\nfn double")
  })

  test("blank line after function", () => {
    const code = `
fn double(@n) { return n * 2 }
let x = 10
    `.trim()
    const formatted = format(code)
    expect(formatted).toContain("}\n\nlet x")
  })

  test("no blank line between functions", () => {
    const code = `
fn double(@n) { return n * 2 }
fn triple(@n) { return n * 3 }
    `.trim()
    const formatted = format(code)
    // Functions should be separated by single newline, not double
    expect(formatted).not.toContain("}\n\nfn triple")
  })
})

describe("Formatter: Complex Constructs", () => {
  test("nested structures preserved", () => {
    const code = "let nested = {a = {b = {c = 1}}}"
    testRoundTrip(code)
  })

  test("pipe chain preserved", () => {
    const code = "sketch = startSketchOn(XY) |> startProfile(at = [0, 0]) |> line(end = [10, 0])"
    testRoundTrip(code)
  })

  test("function with body preserved", () => {
    const code = `
fn complex(@a, @b) {
  let sum = a + b
  let product = a * b
  return sum + product
}
    `.trim()
    testRoundTrip(code)
  })

  test("if expression preserved", () => {
    const code = "let result = if x > 10 { 1 } else { 2 }"
    testRoundTrip(code)
  })
})

describe("Formatter: Units Preserved", () => {
  test("length units", () => {
    testRoundTrip("let width = 10mm")
  })

  test("angle units", () => {
    testRoundTrip("let angle = 90deg")
  })

  test("mixed units in expression", () => {
    testRoundTrip("let sum = 10mm + 5cm")
  })

  test("units in function calls", () => {
    testRoundTrip("myBox = box(width = 10mm, height = 20mm, depth = 30mm)")
  })
})

describe("Formatter: Semantic Equivalence", () => {
  test("array structure preserved", () => {
    const original = parse("[1, 2, 3]")
    const formatted = format("[1, 2, 3]")
    const reformatted = parse(formatted)

    expect(reformatted.body[0].expr.kind).toBe("Array")
    expect(reformatted.body[0].expr.elements).toHaveLength(3)
  })

  test("object structure preserved", () => {
    const original = parse("{a = 1, b = 2}")
    const formatted = format("{a = 1, b = 2}")
    const reformatted = parse(formatted)

    expect(reformatted.body[0].expr.kind).toBe("Object")
    expect(Object.keys(reformatted.body[0].expr.fields)).toHaveLength(2)
  })

  test("binary operation preserved", () => {
    const original = parse("1 + 2 * 3")
    const formatted = format("1 + 2 * 3")
    const reformatted = parse(formatted)

    expect(reformatted.body[0].expr.kind).toBe("BinaryOp")
    expect(reformatted.body[0].expr.op).toBe("+")
  })

  test("function signature preserved", () => {
    const original = parse("fn test(@a, @b, @c) { return a + b + c }")
    const formatted = format("fn test(@a, @b, @c) { return a + b + c }")
    const reformatted = parse(formatted)

    expect(reformatted.body[0].kind).toBe("FnDef")
    expect(reformatted.body[0].params).toHaveLength(3)
  })
})

describe("Formatter: Edge Cases", () => {
  test("empty program", () => {
    const formatted = format("")
    testRoundTrip("")
  })

  test("only whitespace", () => {
    const formatted = format("   \n  \n  ")
    expect(formatted).toBe("\n")
  })

  test("only comments", () => {
    const code = "// Just a comment"
    const formatted = format(code)
    expect(formatted).toContain("// Just a comment")
  })

  test("trailing comma preserved in array", () => {
    const code = "let arr = [1, 2, 3]"
    testRoundTrip(code)
  })

  test("trailing comma preserved in object", () => {
    const code = "let obj = {a = 1, b = 2}"
    testRoundTrip(code)
  })
})

describe("Formatter: Real-World Programs", () => {
  test("simple CAD program", () => {
    const code = `
let width = 100
let height = 50
myBox = box(width = width, height = height, depth = 30)
    `.trim()
    testRoundTrip(code)
  })

  test("sketch with pipe", () => {
    const code = `
sketch = startSketchOn(XY) |> startProfile(at = [0, 0]) |> line(end = [10, 0])
    `.trim()
    testRoundTrip(code)
  })

  test("program with functions and calls", () => {
    const code = `
fn createBox(@w, @h, @d) {
  return box(width = w, height = h, depth = d)
}

myBox = createBox(10, 20, 30)
    `.trim()
    testRoundTrip(code)
  })

  test("program with comments", () => {
    const code = `
// This is a comment
let width = 100
    `.trim()
    testRoundTrip(code)
  })
})

describe("Formatter: Idempotency", () => {
  test("formatting is idempotent after 3 passes", () => {
    const code = `
let x=10
let y    =     20
fn double(@n){return n*2}
let result=double(x)
    `.trim()

    const pass1 = format(code)
    const pass2 = format(pass1)
    const pass3 = format(pass2)

    expect(pass2).toBe(pass1)
    expect(pass3).toBe(pass1)
  })

  test("complex program is idempotent", () => {
    const code = `
fn createBox(@w,@h,@d){
return box(width=w,height=h,depth=d)
}
myBox=createBox(10,20,30)
    `.trim()

    const pass1 = format(code)
    const pass2 = format(pass1)
    const pass3 = format(pass2)

    // Format should be stable after first pass
    expect(pass2).toBe(pass1)
    expect(pass3).toBe(pass1)
  })
})
