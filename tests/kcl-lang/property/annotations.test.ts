import { describe, test, expect } from "bun:test"
import { lex } from "../../../src/kcl-lang/lexer"
import { parse } from "../../../src/kcl-lang/parser"
import { Random } from "./random"

const ITERATIONS = 100

describe("Property-Based Tests: Annotations", () => {
  describe("Annotation parsing is robust", () => {
    test("random annotation names are parsed correctly", () => {
      const rng = new Random(11111)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const name = rng.pick(["settings", "deprecated", "experimental", "config", "version", "doc"])
        const src = `@${name}`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Annotation")
          if (ast.body[0].kind === "Annotation") {
            expect(ast.body[0].name).toBe(name)
            expect(Object.keys(ast.body[0].args).length).toBe(0)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("annotations with random single argument", () => {
      const rng = new Random(22222)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const name = rng.pick(["config", "settings", "option"])
        const argName = rng.pick(["value", "enabled", "count", "size"])
        const argValue = rng.int(1, 100)
        const src = `@${name}(${argName} = ${argValue})`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Annotation")
          if (ast.body[0].kind === "Annotation") {
            expect(ast.body[0].name).toBe(name)
            expect(Object.keys(ast.body[0].args).length).toBe(1)
            expect(argName in ast.body[0].args).toBe(true)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("annotations with random multiple arguments", () => {
      const rng = new Random(33333)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const name = rng.pick(["config", "settings", "metadata"])
        const numArgs = rng.int(2, 5)
        const argNames = ["width", "height", "depth", "radius", "count"]
        const selectedArgs = argNames.slice(0, numArgs)

        const argsStr = selectedArgs.map(arg => `${arg} = ${rng.int(1, 100)}`).join(", ")
        const src = `@${name}(${argsStr})`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Annotation")
          if (ast.body[0].kind === "Annotation") {
            expect(ast.body[0].name).toBe(name)
            expect(Object.keys(ast.body[0].args).length).toBe(numArgs)
            for (const arg of selectedArgs) {
              expect(arg in ast.body[0].args).toBe(true)
            }
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Annotations with different value types", () => {
    test("annotations with string arguments", () => {
      const rng = new Random(44444)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const name = "doc"
        const stringVal = rng.pick(["description", "example", "note", "warning"])
        const src = `@${name}(text = "${stringVal}")`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Annotation")
          if (ast.body[0].kind === "Annotation") {
            expect(ast.body[0].name).toBe(name)
            expect("text" in ast.body[0].args).toBe(true)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("annotations with boolean arguments", () => {
      const rng = new Random(55555)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const name = "feature"
        const boolVal = rng.bool()
        const src = `@${name}(enabled = ${boolVal})`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Annotation")
          if (ast.body[0].kind === "Annotation") {
            expect(ast.body[0].name).toBe(name)
            expect("enabled" in ast.body[0].args).toBe(true)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("annotations with identifier arguments", () => {
      const rng = new Random(66666)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const name = "settings"
        const unit = rng.pick(["mm", "cm", "m", "in", "ft"])
        const src = `@${name}(defaultLengthUnit = ${unit})`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Annotation")
          if (ast.body[0].kind === "Annotation") {
            expect(ast.body[0].name).toBe(name)
            expect("defaultLengthUnit" in ast.body[0].args).toBe(true)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Annotations before declarations", () => {
    test("annotation before function with random parameters", () => {
      const rng = new Random(77777)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const annName = rng.pick(["deprecated", "experimental", "public"])
        const fnName = `fn${rng.int(1, 100)}`
        const returnVal = rng.int(1, 100)
        const src = `@${annName}\nfn ${fnName}() { return ${returnVal} }`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(2)
          expect(ast.body[0].kind).toBe("Annotation")
          expect(ast.body[1].kind).toBe("FnDef")
          if (ast.body[0].kind === "Annotation") {
            expect(ast.body[0].name).toBe(annName)
          }
          if (ast.body[1].kind === "FnDef") {
            expect(ast.body[1].name).toBe(fnName)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("annotation before variable with random values", () => {
      const rng = new Random(88888)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const annName = rng.pick(["experimental", "readonly", "config"])
        const varName = `var${rng.int(1, 100)}`
        const varValue = rng.int(1, 1000)
        const src = `@${annName}\nlet ${varName} = ${varValue}`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(2)
          expect(ast.body[0].kind).toBe("Annotation")
          expect(ast.body[1].kind).toBe("Let")
          if (ast.body[0].kind === "Annotation") {
            expect(ast.body[0].name).toBe(annName)
          }
          if (ast.body[1].kind === "Let") {
            expect(ast.body[1].name).toBe(varName)
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Multiple annotations on same declaration", () => {
    test("N annotations before declaration", () => {
      const rng = new Random(99999)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const numAnn = rng.int(2, 5)
        const annNames = ["settings", "version", "doc", "experimental", "deprecated"]
        const selectedAnns = annNames.slice(0, numAnn)

        const annsStr = selectedAnns.map(a => `@${a}`).join("\n")
        const varValue = rng.int(1, 100)
        const src = `${annsStr}\nlet value = ${varValue}`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(numAnn + 1)

          // Check all annotations
          for (let j = 0; j < numAnn; j++) {
            expect(ast.body[j].kind).toBe("Annotation")
            if (ast.body[j].kind === "Annotation") {
              expect(ast.body[j].name).toBe(selectedAnns[j])
            }
          }

          // Check declaration
          expect(ast.body[numAnn].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Annotation argument value preservation", () => {
    test("numeric argument values are preserved", () => {
      const rng = new Random(101010)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const value = rng.int(-1000, 1000)
        const src = `@config(value = ${value})`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Annotation")
          if (ast.body[0].kind === "Annotation") {
            const arg = ast.body[0].args["value"]
            expect(arg).toBeDefined()
            if (arg && arg.kind === "Number") {
              expect(arg.value).toBe(value)
            }
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("multiple argument values are all preserved", () => {
      const rng = new Random(111111)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const width = rng.int(1, 100)
        const height = rng.int(1, 100)
        const depth = rng.int(1, 100)
        const src = `@config(width = ${width}, height = ${height}, depth = ${depth})`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          expect(ast.body.length).toBe(1)
          expect(ast.body[0].kind).toBe("Annotation")
          if (ast.body[0].kind === "Annotation") {
            const args = ast.body[0].args

            if (args["width"] && args["width"].kind === "Number") {
              expect(args["width"].value).toBe(width)
            }
            if (args["height"] && args["height"].kind === "Number") {
              expect(args["height"].value).toBe(height)
            }
            if (args["depth"] && args["depth"].kind === "Number") {
              expect(args["depth"].value).toBe(depth)
            }
          }
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })

  describe("Annotations don't interfere with compilation", () => {
    test("annotated functions compile correctly", () => {
      const rng = new Random(121212)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const value = rng.int(1, 100)
        const src = `@public\nfn getVal() { return ${value} }`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          // Should parse successfully
          expect(ast.body.length).toBe(2)
          expect(ast.body[0].kind).toBe("Annotation")
          expect(ast.body[1].kind).toBe("FnDef")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })

    test("annotated variables compile correctly", () => {
      const rng = new Random(131313)
      let successes = 0

      for (let i = 0; i < ITERATIONS; i++) {
        const val1 = rng.int(1, 50)
        const val2 = rng.int(1, 50)
        const src = `@readonly\nlet x = ${val1}\nlet y = ${val2}\nlet z = x + y`

        try {
          const tokens = lex(src)
          const ast = parse(tokens)

          // Should parse successfully
          expect(ast.body.length).toBe(4)
          expect(ast.body[0].kind).toBe("Annotation")
          expect(ast.body[1].kind).toBe("Let")
          expect(ast.body[2].kind).toBe("Let")
          expect(ast.body[3].kind).toBe("Let")
          successes++
        } catch (error) {
          throw error
        }
      }

      expect(successes).toBe(ITERATIONS)
    })
  })
})
