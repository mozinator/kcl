/**
 * Module Resolver Tests
 */

import { describe, test, expect, beforeEach } from "bun:test"
import { ModuleResolver } from "../../src/kcl-lsp/module-resolver"
import { MemoryFileSystem } from "../../src/kcl-lsp/fs-interface"
import { DocumentManager } from "../../src/kcl-lsp/document-manager"

describe("ModuleResolver", () => {
  let fs: MemoryFileSystem
  let resolver: ModuleResolver
  let docManager: DocumentManager

  beforeEach(() => {
    fs = new MemoryFileSystem()
    resolver = new ModuleResolver(fs)
    docManager = new DocumentManager()
  })

  describe("resolveImport", () => {
    test("resolves relative imports", async () => {
      // Setup files
      fs.setFile("/project/main.kcl", 'import "./shapes.kcl" as shapes')
      fs.setFile("/project/shapes.kcl", "export fn box() { return 1 }")

      const resolved = await resolver.resolveImport("./shapes.kcl", "/project/main.kcl")

      expect(resolved).toBe("/project/shapes.kcl")
    })

    test("resolves relative imports without .kcl extension", async () => {
      fs.setFile("/project/main.kcl", 'import "./shapes" as shapes')
      fs.setFile("/project/shapes.kcl", "export fn box() { return 1 }")

      const resolved = await resolver.resolveImport("./shapes", "/project/main.kcl")

      expect(resolved).toBe("/project/shapes.kcl")
    })

    test("resolves parent directory imports", async () => {
      fs.setFile("/project/sub/main.kcl", 'import "../shapes.kcl" as shapes')
      fs.setFile("/project/shapes.kcl", "export fn box() { return 1 }")

      const resolved = await resolver.resolveImport("../shapes.kcl", "/project/sub/main.kcl")

      expect(resolved).toBe("/project/shapes.kcl")
    })

    test("returns null for non-existent modules", async () => {
      const resolved = await resolver.resolveImport("./nonexistent.kcl", "/project/main.kcl")

      expect(resolved).toBeNull()
      expect(resolver.getErrors().length).toBeGreaterThan(0)
    })

    test("resolves standard library imports", async () => {
      fs.setFile("/stdlib/math.kcl", "export fn sqrt(x) { return x }")

      const resolved = await resolver.resolveImport("@std/math", "/project/main.kcl")

      // Should try to resolve to stdlib directory
      expect(resolved).toBeTruthy()
    })

    test("returns null for unsupported package imports", async () => {
      const resolved = await resolver.resolveImport("some-package", "/project/main.kcl")

      expect(resolved).toBeNull()
      expect(resolver.getErrors().some(e => e.message.includes("Package imports not yet supported"))).toBe(true)
    })
  })

  describe("getModuleExports", () => {
    test("finds exported functions", async () => {
      const code = "export fn box(w, h) { return 1 }"
      const parseResult = docManager.open("/test.kcl", code, 1)

      const exports = await resolver.getModuleExports("/test.kcl", parseResult)

      expect(exports.has("box")).toBe(true)
      expect(exports.get("box")?.kind).toBe("function")
    })

    test("finds exported variables", async () => {
      const code = "export let PI = 3.14159"
      const parseResult = docManager.open("/test.kcl", code, 1)

      const exports = await resolver.getModuleExports("/test.kcl", parseResult)

      expect(exports.has("PI")).toBe(true)
      expect(exports.get("PI")?.kind).toBe("variable")
    })

    test("finds multiple exports", async () => {
      const code = `
        export fn box(w, h) { return 1 }
        export let width = 10
        let privateVar = 20
      `
      const parseResult = docManager.open("/test.kcl", code, 1)

      const exports = await resolver.getModuleExports("/test.kcl", parseResult)

      expect(exports.has("box")).toBe(true)
      expect(exports.has("width")).toBe(true)
      expect(exports.has("privateVar")).toBe(false)
    })

    test("caches module exports", async () => {
      const code = "export fn box() { return 1 }"
      const parseResult = docManager.open("/test.kcl", code, 1)

      const exports1 = await resolver.getModuleExports("/test.kcl", parseResult)
      const exports2 = await resolver.getModuleExports("/test.kcl", parseResult)

      // Should return the same cached object
      expect(exports1).toBe(exports2)
    })
  })

  describe("resolveImportedSymbols", () => {
    test("resolves namespace imports", async () => {
      fs.setFile("/project/shapes.kcl", "export fn box() { return 1 }")

      const code = 'import "./shapes.kcl" as shapes'
      const parseResult = docManager.open("/project/main.kcl", code, 1)
      const imports = resolver.getImports(parseResult)
      const importStmt = imports[0]

      const symbols = await resolver.resolveImportedSymbols(importStmt, "/project/main.kcl")

      expect(symbols.has("shapes")).toBe(true)
      expect(symbols.get("shapes")?.exportName).toBe("*")
    })

    // Note: Named imports (import { x } from "y") are not yet implemented in parser
    // These tests are disabled until parser supports ES6-style imports
  })

  describe("getImports", () => {
    test("finds all import statements", () => {
      const code = `
        import "./shapes.kcl" as shapes
        import "./primitives.kcl" as prims
        let x = 10
      `
      const parseResult = docManager.open("/test.kcl", code, 1)

      const imports = resolver.getImports(parseResult)

      expect(imports.length).toBe(2)
      expect(imports[0].path).toBe("./shapes.kcl")
      expect(imports[1].path).toBe("./primitives.kcl")
    })
  })

  describe("error handling", () => {
    test("records resolution errors", async () => {
      await resolver.resolveImport("./nonexistent.kcl", "/project/main.kcl")

      const errors = resolver.getErrors()
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].importPath).toBe("./nonexistent.kcl")
      expect(errors[0].sourceUri).toBe("/project/main.kcl")
    })

    test("clearErrors removes all errors", async () => {
      await resolver.resolveImport("./nonexistent.kcl", "/project/main.kcl")
      expect(resolver.getErrors().length).toBeGreaterThan(0)

      resolver.clearErrors()
      expect(resolver.getErrors().length).toBe(0)
    })
  })

  describe("cache management", () => {
    test("clearCache clears module cache", async () => {
      const code = "export fn box() { return 1 }"
      const parseResult = docManager.open("/test.kcl", code, 1)

      await resolver.getModuleExports("/test.kcl", parseResult)
      resolver.clearCache()

      // After clearing, should recompute (hard to test directly, but no errors should occur)
      const exports = await resolver.getModuleExports("/test.kcl", parseResult)
      expect(exports.has("box")).toBe(true)
    })
  })
})
