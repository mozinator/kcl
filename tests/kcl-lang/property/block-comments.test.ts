import { describe, test, expect } from "bun:test"
import { lex } from "../../../src/kcl-lang/lexer"
import { parse } from "../../../src/kcl-lang/parser"
import { Random } from "./random"

const ITERATIONS = 100

describe("Property-Based Tests: Block Comments", () => {
  describe("Comment placement robustness", () => {
    test("comments before random statements", () => {
      const rng = new Random(30001)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const varName = `x${rng.int(1, 1000)}`
        const value = rng.int(1, 1000)
        const commentLength = rng.int(1, 50)
        const comment = "x".repeat(commentLength)
        const src = `/* ${comment} */ let ${varName} = ${value}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          if (ast.body[0].kind === "Let") {
            expect(ast.body[0].name).toBe(varName)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("comments after random statements", () => {
      const rng = new Random(30002)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const varName = `y${rng.int(1, 1000)}`
        const value = rng.int(1, 1000)
        const commentLength = rng.int(1, 50)
        const comment = "y".repeat(commentLength)
        const src = `let ${varName} = ${value} /* ${comment} */`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("comments between random statements", () => {
      const rng = new Random(30003)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const val1 = rng.int(1, 100)
        const val2 = rng.int(1, 100)
        const commentText = `comment ${rng.int(1, 1000)}`
        const src = `
          let a = ${val1}
          /* ${commentText} */
          let b = ${val2}
        `

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(2)
          expect(ast.body[0].kind).toBe("Let")
          expect(ast.body[1].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Multi-line comments", () => {
    test("random number of lines in comments", () => {
      const rng = new Random(30004)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const numLines = rng.int(1, 10)
        const lines = Array.from({ length: numLines }, (_, i) => `Line ${i + 1}`)
        const comment = lines.join("\n")
        const value = rng.int(1, 100)
        const src = `/*\n${comment}\n*/ let x = ${value}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("random asterisks in comments", () => {
      const rng = new Random(30005)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const numAsterisks = rng.int(1, 20)
        const asterisks = "*".repeat(numAsterisks)
        const value = rng.int(1, 100)
        const src = `/* ${asterisks} */ let x = ${value}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Comments in expressions", () => {
    test("comments in random arithmetic expressions", () => {
      const rng = new Random(30006)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const a = rng.int(1, 100)
        const b = rng.int(1, 100)
        const op = rng.pick(["+", "-", "*"])
        const src = `let result = ${a} /* op */ ${op} /* val */ ${b}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          if (ast.body[0].kind === "Let" && ast.body[0].expr.kind === "BinaryOp") {
            expect(ast.body[0].expr.op).toBe(op)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("comments in random array literals", () => {
      const rng = new Random(30007)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const size = rng.int(1, 8)
        const elements: string[] = []

        for (let j = 0; j < size; j++) {
          const val = rng.int(1, 100)
          // Add comment before or after element (not as a separate element)
          if (rng.bool()) {
            elements.push(`/* c${j} */ ${val}`)
          } else {
            elements.push(`${val} /* c${j} */`)
          }
        }

        const src = `let arr = [${elements.join(", ")}]`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          if (ast.body[0].kind === "Let" && ast.body[0].expr.kind === "Array") {
            expect(ast.body[0].expr.elements.length).toBe(size)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Multiple comments", () => {
    test("random number of successive comments", () => {
      const rng = new Random(30008)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const numComments = rng.int(1, 10)
        const comments = Array.from({ length: numComments }, (_, i) => `/* comment ${i} */`).join(" ")
        const value = rng.int(1, 100)
        const src = `${comments} let x = ${value}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("random interspersed comments in statements", () => {
      const rng = new Random(30009)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const numStmts = rng.int(2, 6)
        const stmts: string[] = []

        for (let j = 0; j < numStmts; j++) {
          if (rng.bool()) {
            stmts.push(`/* comment ${j} */`)
          }
          stmts.push(`let v${j} = ${rng.int(1, 100)}`)
        }

        const src = stmts.join("\n")

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(numStmts)
          for (const stmt of ast.body) {
            expect(stmt.kind).toBe("Let")
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Comment content variations", () => {
    test("comments with random special characters", () => {
      const rng = new Random(30010)
      let successes = 0

      const specialChars = ["!", "@", "#", "$", "%", "^", "&", "(", ")", "-", "+", "=", "[", "]", "{", "}", "|", ":", ";", "'", "<", ">", "?", ",", "."]

      for (let i = 0; i < ITERATIONS; i++) {
        const numChars = rng.int(1, 10)
        const chars = Array.from({ length: numChars }, () => rng.pick(specialChars)).join("")
        const value = rng.int(1, 100)
        const src = `/* ${chars} */ let x = ${value}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("comments with random slashes", () => {
      const rng = new Random(30011)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const numSlashes = rng.int(1, 5)
        const slashes = "/".repeat(numSlashes)
        const value = rng.int(1, 100)
        const src = `/* comment with ${slashes} inside */ let x = ${value}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("empty comments", () => {
      const rng = new Random(30012)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const value = rng.int(1, 100)
        const src = `/**/ let x = ${value}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Comments with line comments", () => {
    test("mixed block and line comments", () => {
      const rng = new Random(30013)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const useBlockFirst = rng.bool()
        const value = rng.int(1, 100)

        const src = useBlockFirst
          ? `/* block */ // line\nlet x = ${value}`
          : `// line\n/* block */ let x = ${value}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("line comments containing block comment syntax", () => {
      const rng = new Random(30014)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const value = rng.int(1, 100)
        const src = `// This is not /* a block comment\nlet x = ${value}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Documentation-style comments", () => {
    test("comments before random functions", () => {
      const rng = new Random(30015)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const fnName = `fn${rng.int(1, 1000)}`
        const paramName = `p${rng.int(1, 100)}`
        const returnValue = rng.int(1, 100)
        const src = `
          /*
           * Function ${fnName}
           * @param ${paramName} - The parameter
           * @return The result
           */
          fn ${fnName}(@${paramName}) {
            return ${returnValue}
          }
        `

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("FnDef")
          if (ast.body[0].kind === "FnDef") {
            expect(ast.body[0].name).toBe(fnName)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("module header comments with random content", () => {
      const rng = new Random(30016)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const moduleName = `Module${rng.int(1, 1000)}`
        const version = `${rng.int(1, 9)}.${rng.int(0, 9)}.${rng.int(0, 99)}`
        const value1 = rng.int(1, 100)
        const value2 = rng.int(1, 100)
        const src = `
          /*
           * ${moduleName}
           * Version: ${version}
           * Description: Random module
           */

          let a = ${value1}
          let b = ${value2}
        `

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(2)
          expect(ast.body[0].kind).toBe("Let")
          expect(ast.body[1].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Edge cases", () => {
    test("only comments with random content", () => {
      const rng = new Random(30017)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const commentLength = rng.int(1, 100)
        const comment = "x".repeat(commentLength)
        const src = `/* ${comment} */`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(0)
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("comments with random newlines", () => {
      const rng = new Random(30018)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const numNewlines = rng.int(1, 10)
        const newlines = "\n".repeat(numNewlines)
        const value = rng.int(1, 100)
        const src = `/*${newlines}comment${newlines}*/ let x = ${value}`

        try {
          const ast = parse(src)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("unterminated comments with random content", () => {
      const rng = new Random(30019)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const value = rng.int(1, 100)
        const commentText = `comment ${rng.int(1, 1000)}`
        const src = `let x = ${value} /* ${commentText}`

        try {
          const ast = parse(src)

          // Unterminated comment consumes to EOF, but let statement should still parse
          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })
})
