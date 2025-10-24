/**
 * Module Resolution
 *
 * Resolves import statements to actual file paths using the filesystem abstraction.
 * Works in both Bun and browser modes.
 */

import type { FileSystem, FileUri } from "./fs-interface"
import type { ParseResult } from "./document-manager"
import type { ImportItem, Stmt } from "../kcl-lang/ast"

export type ResolvedModule = {
  uri: FileUri
  exports: Map<string, ModuleExport>
}

export type ModuleExport = {
  kind: "function" | "variable" | "type"
  name: string
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
}

export type ModuleResolutionError = {
  message: string
  importPath: string
  sourceUri: FileUri
}

/**
 * Module Resolver
 *
 * Handles resolving import paths to files and tracking module dependencies
 */
export class ModuleResolver {
  private fs: FileSystem
  private moduleCache = new Map<FileUri, ResolvedModule>()
  private resolutionErrors: ModuleResolutionError[] = []

  constructor(fs: FileSystem) {
    this.fs = fs
  }

  /**
   * Resolve an import statement to a file URI
   */
  async resolveImport(
    importPath: string,
    sourceUri: FileUri
  ): Promise<FileUri | null> {
    // Clear previous errors for this import
    this.resolutionErrors = this.resolutionErrors.filter(
      e => !(e.importPath === importPath && e.sourceUri === sourceUri)
    )

    try {
      // Handle different import patterns
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        // Relative import
        return await this.resolveRelativeImport(importPath, sourceUri)
      } else if (importPath.startsWith("@std/")) {
        // Standard library import
        return await this.resolveStdLibImport(importPath)
      } else {
        // Package import (not yet supported)
        this.addError(`Package imports not yet supported: ${importPath}`, importPath, sourceUri)
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.addError(message, importPath, sourceUri)
      return null
    }
  }

  /**
   * Resolve a relative import (./foo.kcl or ../bar.kcl)
   */
  private async resolveRelativeImport(
    importPath: string,
    sourceUri: FileUri
  ): Promise<FileUri> {
    // Try with .kcl extension if not present
    let resolved = this.fs.resolve(sourceUri, importPath)

    if (!resolved.endsWith(".kcl")) {
      resolved = resolved + ".kcl"
    }

    // Check if file exists
    const exists = await this.fs.exists(resolved)
    if (!exists) {
      throw new Error(`Module not found: ${importPath}`)
    }

    return resolved
  }

  /**
   * Resolve a standard library import (@std/...)
   */
  private async resolveStdLibImport(importPath: string): Promise<FileUri> {
    // Standard library is typically bundled or at a known location
    // For now, we'll assume it's in a stdlib directory

    // Remove @std/ prefix
    const moduleName = importPath.substring(5)

    // Try common locations
    const possiblePaths = [
      `/stdlib/${moduleName}.kcl`,
      `/usr/local/lib/kcl/std/${moduleName}.kcl`,
      `./node_modules/@kcl/std/${moduleName}.kcl`,
    ]

    for (const path of possiblePaths) {
      const exists = await this.fs.exists(path)
      if (exists) {
        return path
      }
    }

    throw new Error(`Standard library module not found: ${importPath}`)
  }

  /**
   * Get all exports from a module
   */
  async getModuleExports(uri: FileUri, parseResult: ParseResult): Promise<Map<string, ModuleExport>> {
    // Check cache
    const cached = this.moduleCache.get(uri)
    if (cached) {
      return cached.exports
    }

    const exports = new Map<string, ModuleExport>()

    if (!parseResult.success) {
      return exports
    }

    // Find all exported symbols
    for (const stmt of parseResult.program.body) {
      if (stmt.kind === "Export") {
        const exportedStmt = stmt.stmt

        if (exportedStmt.kind === "FnDef") {
          // Find the token for position info
          const token = findIdentToken(parseResult, exportedStmt.name)
          if (token) {
            exports.set(exportedStmt.name, {
              kind: "function",
              name: exportedStmt.name,
              range: token.range,
            })
          }
        } else if (exportedStmt.kind === "Let") {
          const token = findIdentToken(parseResult, exportedStmt.name)
          if (token) {
            exports.set(exportedStmt.name, {
              kind: "variable",
              name: exportedStmt.name,
              range: token.range,
            })
          }
        }
      }
    }

    // Cache the result
    this.moduleCache.set(uri, { uri, exports })

    return exports
  }

  /**
   * Resolve imported symbols from a module
   */
  async resolveImportedSymbols(
    importStmt: Extract<Stmt, { kind: "Import" }>,
    sourceUri: FileUri
  ): Promise<Map<string, { exportName: string; moduleUri: FileUri }>> {
    const resolved = new Map<string, { exportName: string; moduleUri: FileUri }>()

    // Resolve the module
    const moduleUri = await this.resolveImport(importStmt.path, sourceUri)
    if (!moduleUri) {
      return resolved
    }

    // Get the module's exports (requires parsing the imported module)
    // For now, we'll return the mapping without validating exports exist

    if (importStmt.items) {
      // Named imports: import { x, y as z } from "./foo"
      for (const item of importStmt.items) {
        const localName = item.alias || item.name
        resolved.set(localName, {
          exportName: item.name,
          moduleUri,
        })
      }
    } else if (importStmt.alias) {
      // Namespace import: import "./foo" as foo
      resolved.set(importStmt.alias, {
        exportName: "*", // All exports
        moduleUri,
      })
    }

    return resolved
  }

  /**
   * Get all imports from a document
   */
  getImports(parseResult: ParseResult): Extract<Stmt, { kind: "Import" }>[] {
    if (!parseResult.success) {
      return []
    }

    return parseResult.program.body.filter(
      (stmt): stmt is Extract<Stmt, { kind: "Import" }> => stmt.kind === "Import"
    )
  }

  /**
   * Get all resolution errors
   */
  getErrors(): ModuleResolutionError[] {
    return this.resolutionErrors
  }

  /**
   * Clear the module cache
   */
  clearCache() {
    this.moduleCache.clear()
  }

  /**
   * Clear errors
   */
  clearErrors() {
    this.resolutionErrors = []
  }

  private addError(message: string, importPath: string, sourceUri: FileUri) {
    this.resolutionErrors.push({
      message,
      importPath,
      sourceUri,
    })
  }
}

/**
 * Find an identifier token by name
 */
function findIdentToken(parseResult: ParseResult, name: string): any {
  for (const token of parseResult.tokens) {
    if (token.k === "Ident" && token.v === name) {
      return token
    }
  }
  return null
}
