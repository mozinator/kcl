/**
 * camelCase Naming Rule
 *
 * Enforces camelCase naming convention for variables and functions.
 * Allows: camelCase, single letters, ALL_CAPS constants
 * Disallows: snake_case, kebab-case
 */

import type { LintRule, LintContext } from "../engine"
import type { Diagnostic } from "../../protocol"
import type { Stmt } from "../../../kcl-lang/ast"

export const camelCaseRule: LintRule = {
  name: "camelCase",
  description: "Variable and function names should use camelCase",
  severity: "warning",

  check(context: LintContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = []

    for (const stmt of context.program.body) {
      checkStatement(stmt, diagnostics, context)
    }

    return diagnostics
  }
}

function checkStatement(stmt: Stmt, diagnostics: Diagnostic[], context: LintContext) {
  // Check variable names
  if (stmt.kind === "Let" || stmt.kind === "Assign") {
    if (!isCamelCase(stmt.name)) {
      const token = findIdentToken(context.tokens, stmt.name)
      if (token) {
        diagnostics.push({
          range: token.range,
          severity: 2, // Warning
          source: "kcl-lint",
          message: `Variable '${stmt.name}' should use camelCase naming`,
        })
      }
    }
  }

  // Check function names
  if (stmt.kind === "FnDef") {
    if (!isCamelCase(stmt.name)) {
      const token = findIdentToken(context.tokens, stmt.name)
      if (token) {
        diagnostics.push({
          range: token.range,
          severity: 2, // Warning
          source: "kcl-lint",
          message: `Function '${stmt.name}' should use camelCase naming`,
        })
      }
    }

    // Check function body recursively
    for (const bodyStmt of stmt.body) {
      checkStatement(bodyStmt, diagnostics, context)
    }
  }

  // Check exported statements
  if (stmt.kind === "Export") {
    checkStatement(stmt.stmt, diagnostics, context)
  }
}

/**
 * Check if a name follows camelCase convention
 */
function isCamelCase(name: string): boolean {
  // Single letters are okay
  if (name.length === 1) {
    return true
  }

  // ALL_CAPS constants are okay (common for PI, MAX_SIZE, etc.)
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
    return true
  }

  // camelCase: starts with lowercase, no underscores or hyphens
  // Allow numbers after first character
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) {
    return true
  }

  return false
}

/**
 * Find an identifier token by name
 */
function findIdentToken(tokens: any[], name: string): any {
  for (const token of tokens) {
    if (token.k === "Ident" && token.v === name) {
      return token
    }
  }
  return null
}
