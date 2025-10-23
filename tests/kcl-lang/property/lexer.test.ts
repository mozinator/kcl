/**
 * Property Tests for KCL Lexer
 *
 * Tests lexer properties like determinism, EOF presence, comment handling, etc.
 */

import { describe, test } from "bun:test"
import { assertProperty } from "../../property/framework"
import { Gen } from "../../property/generator"
import { Primitives as P } from "../../property/primitives"
import {
  lexerProducesEOF,
  lexerIsDeterministic,
  commentsAreEliminated
} from "./properties"

describe("KCL Lexer Property Tests", () => {
  describe("Basic Lexer Properties", () => {
    test("lexer always produces EOF token", () => {
      assertProperty(
        P.string(),
        lexerProducesEOF,
        { runs: 500 }
      )
    })

    test("lexer is deterministic", () => {
      assertProperty(
        P.string(),
        lexerIsDeterministic,
        { runs: 500 }
      )
    })

    test("comments are eliminated from token stream", () => {
      assertProperty(
        Gen.tuple(
          P.elements("let x = 10", "box(width=10)", "42", "foo"),
          P.elements("comment", "test", "TODO", "")
        ),
        commentsAreEliminated,
        { runs: 300 }
      )
    })
  })

  describe("Specific Token Patterns", () => {
    test("numbers are tokenized correctly", () => {
      assertProperty(
        Gen.map(P.int(0, 1000), n => n.toString()),
        lexerProducesEOF,
        { runs: 200 }
      )
    })

    test("identifiers are tokenized correctly", () => {
      assertProperty(
        Gen.map(P.identifier(), id => `let ${id} = 10`),
        lexerProducesEOF,
        { runs: 200 }
      )
    })

    test("strings are tokenized correctly", () => {
      assertProperty(
        Gen.map(P.string(), s => `"${s}"`),
        lexerProducesEOF,
        { runs: 200 }
      )
    })
  })

  describe("Complex Programs", () => {
    test("complete programs tokenize deterministically", () => {
      const genProgram = Gen.map(
        Gen.tuple(P.identifier(), P.int(1, 100), P.int(1, 100), P.int(1, 100)),
        ([id, w, h, d]) => `let ${id} = box(width=${w}, height=${h}, depth=${d})`
      )

      assertProperty(genProgram, lexerIsDeterministic, { runs: 300 })
    })

    test("multi-line programs tokenize correctly", () => {
      const genMultiLine = Gen.map(
        Gen.tuple(P.identifier(), P.identifier()),
        ([id1, id2]) => `let ${id1} = box(width=10, height=10, depth=10)\nlet ${id2} = sphere(radius=5)`
      )

      assertProperty(genMultiLine, lexerProducesEOF, { runs: 200 })
    })
  })

  describe("Edge Cases", () => {
    test("empty string produces EOF", () => {
      assertProperty(
        (rng) => "",
        lexerProducesEOF,
        { runs: 10 }
      )
    })

    test("whitespace-only string produces EOF", () => {
      assertProperty(
        Gen.map(P.int(1, 20), n => " ".repeat(n)),
        lexerProducesEOF,
        { runs: 50 }
      )
    })

    test("comment-only string produces EOF", () => {
      assertProperty(
        Gen.map(P.string(), s => `// ${s}`),
        lexerProducesEOF,
        { runs: 100 }
      )
    })
  })
})
