/**
 * Unused Variable Rule
 *
 * Warns about variables that are defined but never used.
 * Exceptions: Exported variables are considered used.
 */

import type { LintRule, LintContext } from "../engine"
import type { Diagnostic } from "../../protocol"
import type { Stmt, Expr } from "../../../kcl-lang/ast"

export const unusedVariableRule: LintRule = {
  name: "unusedVariable",
  description: "Variables should be used after being defined",
  severity: "warning",

  check(context: LintContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = []

    // Collect all variable definitions
    const definitions = new Map<string, { stmt: Stmt; token: any; isExported: boolean }>()
    const usages = new Set<string>()

    // First pass: collect definitions
    for (const stmt of context.program.body) {
      collectDefinitions(stmt, definitions, context.tokens, false)
    }

    // Second pass: collect usages
    for (const stmt of context.program.body) {
      collectUsages(stmt, usages)
    }

    // Check for unused variables
    for (const [name, info] of definitions) {
      if (!info.isExported && !usages.has(name)) {
        if (info.token) {
          diagnostics.push({
            range: info.token.range,
            severity: 2, // Warning
            source: "kcl-lint",
            message: `Variable '${name}' is defined but never used`,
          })
        }
      }
    }

    return diagnostics
  }
}

function collectDefinitions(
  stmt: Stmt,
  definitions: Map<string, { stmt: Stmt; token: any; isExported: boolean }>,
  tokens: any[],
  isExported: boolean
) {
  if (stmt.kind === "Let" || stmt.kind === "Assign") {
    const token = findIdentToken(tokens, stmt.name)
    definitions.set(stmt.name, { stmt, token, isExported })
  } else if (stmt.kind === "FnDef") {
    // Functions are implicitly "used" if they're defined (could be called externally)
    // So we don't track them as potentially unused
    // But we do check their body for unused variables
    for (const bodyStmt of stmt.body) {
      collectDefinitions(bodyStmt, definitions, tokens, false)
    }
  } else if (stmt.kind === "Export") {
    // Exported items are considered used
    collectDefinitions(stmt.stmt, definitions, tokens, true)
  }
}

function collectUsages(stmt: Stmt, usages: Set<string>) {
  if (stmt.kind === "Let" || stmt.kind === "Assign") {
    collectExprUsages(stmt.expr, usages)
  } else if (stmt.kind === "Return" && stmt.expr) {
    collectExprUsages(stmt.expr, usages)
  } else if (stmt.kind === "ExprStmt") {
    collectExprUsages(stmt.expr, usages)
  } else if (stmt.kind === "FnDef") {
    for (const bodyStmt of stmt.body) {
      collectUsages(bodyStmt, usages)
    }
    if (stmt.returnExpr) {
      collectExprUsages(stmt.returnExpr, usages)
    }
  } else if (stmt.kind === "Export") {
    collectUsages(stmt.stmt, usages)
  }
}

function collectExprUsages(expr: Expr, usages: Set<string>) {
  if (expr.kind === "Var") {
    usages.add(expr.name)
  } else if (expr.kind === "Call") {
    usages.add(expr.callee)
    for (const arg of Object.values(expr.args)) {
      collectExprUsages(arg, usages)
    }
  } else if (expr.kind === "BinaryOp") {
    collectExprUsages(expr.left, usages)
    collectExprUsages(expr.right, usages)
  } else if (expr.kind === "UnaryMinus" || expr.kind === "UnaryNot") {
    collectExprUsages(expr.operand, usages)
  } else if (expr.kind === "Array") {
    for (const element of expr.elements) {
      collectExprUsages(element, usages)
    }
  } else if (expr.kind === "Object") {
    for (const value of Object.values(expr.fields)) {
      collectExprUsages(value, usages)
    }
  } else if (expr.kind === "Pipe") {
    collectExprUsages(expr.left, usages)
    collectExprUsages(expr.right, usages)
  } else if (expr.kind === "Index") {
    collectExprUsages(expr.array, usages)
    collectExprUsages(expr.index, usages)
  } else if (expr.kind === "MemberAccess") {
    collectExprUsages(expr.object, usages)
  } else if (expr.kind === "If") {
    collectExprUsages(expr.condition, usages)
    collectExprUsages(expr.thenBranch, usages)
    for (const branch of expr.elseIfBranches) {
      collectExprUsages(branch.condition, usages)
      collectExprUsages(branch.body, usages)
    }
    if (expr.elseBranch) {
      collectExprUsages(expr.elseBranch, usages)
    }
  } else if (expr.kind === "Range") {
    collectExprUsages(expr.start, usages)
    collectExprUsages(expr.end, usages)
  }
}

function findIdentToken(tokens: any[], name: string): any {
  for (const token of tokens) {
    if (token.k === "Ident" && token.v === name) {
      return token
    }
  }
  return null
}
