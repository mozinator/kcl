/**
 * No Magic Numbers Rule
 *
 * Discourages use of unnamed numeric literals in code.
 * Suggests extracting them to named constants.
 *
 * Exceptions:
 * - 0, 1, -1 (common values)
 * - Numbers with units (42mm, 90deg, etc.)
 * - Numbers in variable declarations (defining constants)
 */

import type { LintRule, LintContext } from "../engine"
import type { Diagnostic } from "../../protocol"
import type { Stmt, Expr } from "../../../kcl-lang/ast"

export const noMagicNumbersRule: LintRule = {
  name: "noMagicNumbers",
  description: "Avoid magic numbers, use named constants instead",
  severity: "info",

  check(context: LintContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = []

    for (const stmt of context.program.body) {
      checkStatement(stmt, diagnostics, context, false)
    }

    return diagnostics
  }
}

function checkStatement(
  stmt: Stmt,
  diagnostics: Diagnostic[],
  context: LintContext,
  isInFunction: boolean
) {
  // Variable declarations: check if RHS is a simple literal or expression with magic numbers
  if (stmt.kind === "Let" || stmt.kind === "Assign") {
    // If the RHS is a simple literal, it's okay (defining a constant)
    // But if it's an expression (e.g., x * 42), check for magic numbers in the expression
    if (stmt.expr.kind !== "Number" && stmt.expr.kind !== "String" && stmt.expr.kind !== "Bool") {
      checkExpression(stmt.expr, diagnostics, context)
    }
  } else if (stmt.kind === "Return" && stmt.expr) {
    checkExpression(stmt.expr, diagnostics, context)
  } else if (stmt.kind === "ExprStmt") {
    checkExpression(stmt.expr, diagnostics, context)
  } else if (stmt.kind === "FnDef") {
    for (const bodyStmt of stmt.body) {
      checkStatement(bodyStmt, diagnostics, context, true)
    }
    if (stmt.returnExpr) {
      checkExpression(stmt.returnExpr, diagnostics, context)
    }
  } else if (stmt.kind === "Export") {
    checkStatement(stmt.stmt, diagnostics, context, isInFunction)
  }
}

function checkExpression(expr: Expr, diagnostics: Diagnostic[], context: LintContext) {
  if (expr.kind === "Number") {
    // Allow 0, 1, -1
    if (expr.value === 0 || expr.value === 1 || expr.value === -1) {
      return
    }

    // Allow numbers with units (they're measurements, not magic)
    if (expr.unit) {
      return
    }

    // Find the token for this number
    const token = findNumberToken(context.tokens, expr.value)
    if (token) {
      diagnostics.push({
        range: token.range,
        severity: 3, // Info
        source: "kcl-lint",
        message: `Avoid magic number ${expr.value}, consider using a named constant`,
      })
    }
  } else if (expr.kind === "Call") {
    for (const arg of Object.values(expr.args)) {
      checkExpression(arg, diagnostics, context)
    }
  } else if (expr.kind === "BinaryOp") {
    checkExpression(expr.left, diagnostics, context)
    checkExpression(expr.right, diagnostics, context)
  } else if (expr.kind === "UnaryMinus") {
    // Check if it's a negative number literal
    if (expr.operand.kind === "Number") {
      const value = -expr.operand.value
      if (value !== 0 && value !== -1) {
        const token = findNumberToken(context.tokens, expr.operand.value)
        if (token) {
          diagnostics.push({
            range: token.range,
            severity: 3, // Info
            source: "kcl-lint",
            message: `Avoid magic number ${value}, consider using a named constant`,
          })
        }
      }
    } else {
      checkExpression(expr.operand, diagnostics, context)
    }
  } else if (expr.kind === "UnaryNot") {
    checkExpression(expr.operand, diagnostics, context)
  } else if (expr.kind === "Array") {
    for (const element of expr.elements) {
      checkExpression(element, diagnostics, context)
    }
  } else if (expr.kind === "Object") {
    for (const value of Object.values(expr.fields)) {
      checkExpression(value, diagnostics, context)
    }
  } else if (expr.kind === "Pipe") {
    checkExpression(expr.left, diagnostics, context)
    checkExpression(expr.right, diagnostics, context)
  } else if (expr.kind === "Index") {
    checkExpression(expr.array, diagnostics, context)
    checkExpression(expr.index, diagnostics, context)
  } else if (expr.kind === "MemberAccess") {
    checkExpression(expr.object, diagnostics, context)
  } else if (expr.kind === "If") {
    checkExpression(expr.condition, diagnostics, context)
    checkExpression(expr.thenBranch, diagnostics, context)
    for (const branch of expr.elseIfBranches) {
      checkExpression(branch.condition, diagnostics, context)
      checkExpression(branch.body, diagnostics, context)
    }
    if (expr.elseBranch) {
      checkExpression(expr.elseBranch, diagnostics, context)
    }
  } else if (expr.kind === "Range") {
    checkExpression(expr.start, diagnostics, context)
    checkExpression(expr.end, diagnostics, context)
  }
}

function findNumberToken(tokens: any[], value: number): any {
  for (const token of tokens) {
    if (token.k === "Num" && token.v === value) {
      return token
    }
  }
  return null
}
