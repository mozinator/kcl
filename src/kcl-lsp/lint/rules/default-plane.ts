/**
 * Default Plane Rule
 *
 * Warns when using implicit default plane instead of explicit plane specification.
 * Best practice: Always specify which plane you're drawing on.
 */

import type { LintRule, LintContext } from "../engine"
import type { Diagnostic } from "../../protocol"
import type { Stmt, Expr } from "../../../kcl-lang/ast"

// CAD operations that should specify a plane
const PLANE_OPERATIONS = ["line", "arc", "circle", "tangentialArc", "angledLine"]

export const defaultPlaneRule: LintRule = {
  name: "defaultPlane",
  description: "Specify an explicit plane instead of using the default",
  severity: "info",

  check(context: LintContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = []

    for (const stmt of context.program.body) {
      checkStatement(stmt, diagnostics, context)
    }

    return diagnostics
  }
}

function checkStatement(stmt: Stmt, diagnostics: Diagnostic[], context: LintContext) {
  if (stmt.kind === "Let" || stmt.kind === "Assign") {
    checkExpression(stmt.expr, diagnostics, context)
  } else if (stmt.kind === "Return" && stmt.expr) {
    checkExpression(stmt.expr, diagnostics, context)
  } else if (stmt.kind === "ExprStmt") {
    checkExpression(stmt.expr, diagnostics, context)
  } else if (stmt.kind === "FnDef") {
    for (const bodyStmt of stmt.body) {
      checkStatement(bodyStmt, diagnostics, context)
    }
    if (stmt.returnExpr) {
      checkExpression(stmt.returnExpr, diagnostics, context)
    }
  } else if (stmt.kind === "Export") {
    checkStatement(stmt.stmt, diagnostics, context)
  }
}

function checkExpression(expr: Expr, diagnostics: Diagnostic[], context: LintContext) {
  if (expr.kind === "Call") {
    // Check if this is a plane operation
    if (PLANE_OPERATIONS.includes(expr.callee)) {
      // Check if 'plane' argument is provided
      const hasPlaneArg = "plane" in expr.args

      if (!hasPlaneArg) {
        // Find the token for this call
        const token = findCallToken(context.tokens, expr.callee)
        if (token) {
          diagnostics.push({
            range: token.range,
            severity: 3, // Info
            source: "kcl-lint",
            message: `Consider specifying an explicit 'plane' parameter for ${expr.callee}()`,
          })
        }
      }
    }

    // Recursively check arguments
    for (const arg of Object.values(expr.args)) {
      checkExpression(arg, diagnostics, context)
    }
  } else if (expr.kind === "BinaryOp") {
    checkExpression(expr.left, diagnostics, context)
    checkExpression(expr.right, diagnostics, context)
  } else if (expr.kind === "UnaryMinus" || expr.kind === "UnaryNot") {
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

function findCallToken(tokens: any[], callee: string): any {
  for (const token of tokens) {
    if (token.k === "Ident" && token.v === callee) {
      return token
    }
  }
  return null
}
