/**
 * AST Utility Functions
 *
 * Helper functions for traversing, querying, and manipulating KCL ASTs.
 */

import type { Program, Stmt, Expr, Param } from "./ast"

/**
 * Visitor pattern for AST traversal
 */
export type Visitor = {
  enterProgram?: (node: Program) => void | boolean
  exitProgram?: (node: Program) => void
  enterStmt?: (node: Stmt) => void | boolean
  exitStmt?: (node: Stmt) => void
  enterExpr?: (node: Expr) => void | boolean
  exitExpr?: (node: Expr) => void
}

/**
 * Traverse an AST with a visitor
 * Returns false if traversal was stopped early
 */
export function traverse(program: Program, visitor: Visitor): boolean {
  // Visit program
  if (visitor.enterProgram) {
    const result = visitor.enterProgram(program)
    if (result === false) return false
  }

  // Visit all statements
  for (const stmt of program.body) {
    if (!traverseStmt(stmt, visitor)) return false
  }

  if (visitor.exitProgram) {
    visitor.exitProgram(program)
  }

  return true
}

/**
 * Traverse a statement
 */
function traverseStmt(stmt: Stmt, visitor: Visitor): boolean {
  if (visitor.enterStmt) {
    const result = visitor.enterStmt(stmt)
    if (result === false) return false
  }

  switch (stmt.kind) {
    case "Let":
    case "Assign":
      if (!traverseExpr(stmt.expr, visitor)) return false
      break

    case "FnDef":
      // Traverse function body
      for (const bodyStmt of stmt.body) {
        if (!traverseStmt(bodyStmt, visitor)) return false
      }
      // Traverse return expression
      if (stmt.returnExpr && !traverseExpr(stmt.returnExpr, visitor)) {
        return false
      }
      break

    case "Return":
      if (stmt.expr && !traverseExpr(stmt.expr, visitor)) return false
      break

    case "ExprStmt":
      if (!traverseExpr(stmt.expr, visitor)) return false
      break

    case "Annotation":
      // Traverse annotation arguments
      for (const argExpr of Object.values(stmt.args)) {
        if (!traverseExpr(argExpr, visitor)) return false
      }
      break

    case "Export":
      if (!traverseStmt(stmt.stmt, visitor)) return false
      break

    case "Import":
    case "ExportImport":
      // No expressions to traverse
      break
  }

  if (visitor.exitStmt) {
    visitor.exitStmt(stmt)
  }

  return true
}

/**
 * Traverse an expression
 */
function traverseExpr(expr: Expr, visitor: Visitor): boolean {
  if (visitor.enterExpr) {
    const result = visitor.enterExpr(expr)
    if (result === false) return false
  }

  switch (expr.kind) {
    case "Array":
      for (const elem of expr.elements) {
        if (!traverseExpr(elem, visitor)) return false
      }
      break

    case "Object":
      for (const fieldExpr of Object.values(expr.fields)) {
        if (!traverseExpr(fieldExpr, visitor)) return false
      }
      break

    case "Call":
      for (const argExpr of Object.values(expr.args)) {
        if (!traverseExpr(argExpr, visitor)) return false
      }
      break

    case "Pipe":
      if (!traverseExpr(expr.left, visitor)) return false
      if (!traverseExpr(expr.right, visitor)) return false
      break

    case "UnaryMinus":
    case "UnaryNot":
      if (!traverseExpr(expr.operand, visitor)) return false
      break

    case "BinaryOp":
      if (!traverseExpr(expr.left, visitor)) return false
      if (!traverseExpr(expr.right, visitor)) return false
      break

    case "Index":
      if (!traverseExpr(expr.array, visitor)) return false
      if (!traverseExpr(expr.index, visitor)) return false
      break

    case "Range":
      if (!traverseExpr(expr.start, visitor)) return false
      if (!traverseExpr(expr.end, visitor)) return false
      break

    case "MemberAccess":
      if (!traverseExpr(expr.object, visitor)) return false
      break

    case "TypeAscription":
      if (!traverseExpr(expr.expr, visitor)) return false
      break

    case "If":
      if (!traverseExpr(expr.condition, visitor)) return false
      if (!traverseExpr(expr.thenBranch, visitor)) return false
      for (const elseIfBranch of expr.elseIfBranches) {
        if (!traverseExpr(elseIfBranch.condition, visitor)) return false
        if (!traverseExpr(elseIfBranch.body, visitor)) return false
      }
      if (expr.elseBranch && !traverseExpr(expr.elseBranch, visitor)) {
        return false
      }
      break

    case "AnonymousFn":
      for (const bodyStmt of expr.body) {
        if (!traverseStmt(bodyStmt, visitor)) return false
      }
      if (expr.returnExpr && !traverseExpr(expr.returnExpr, visitor)) {
        return false
      }
      break

    case "Number":
    case "Bool":
    case "String":
    case "Nil":
    case "Var":
    case "PipeSubstitution":
    case "TagDeclarator":
      // Leaf nodes - nothing to traverse
      break
  }

  if (visitor.exitExpr) {
    visitor.exitExpr(expr)
  }

  return true
}

/**
 * Find all variables defined in a program
 */
export function findAllVariables(program: Program): string[] {
  const variables: string[] = []

  traverse(program, {
    enterStmt(stmt) {
      if (stmt.kind === "Let" || stmt.kind === "Assign") {
        variables.push(stmt.name)
      } else if (stmt.kind === "FnDef") {
        variables.push(stmt.name)
      }
    },
  })

  return variables
}

/**
 * Find all function definitions in a program
 */
export function findAllFunctions(program: Program): Array<{ name: string; params: Param[] }> {
  const functions: Array<{ name: string; params: Param[] }> = []

  traverse(program, {
    enterStmt(stmt) {
      if (stmt.kind === "FnDef") {
        functions.push({ name: stmt.name, params: stmt.params })
      } else if (stmt.kind === "Export" && stmt.stmt.kind === "FnDef") {
        functions.push({ name: stmt.stmt.name, params: stmt.stmt.params })
      }
    },
  })

  return functions
}

/**
 * Find all function calls in a program
 */
export function findAllCalls(program: Program): string[] {
  const calls: string[] = []

  traverse(program, {
    enterExpr(expr) {
      if (expr.kind === "Call") {
        calls.push(expr.callee)
      }
    },
  })

  return calls
}

/**
 * Find all variable references in a program
 */
export function findAllReferences(program: Program): string[] {
  const references: string[] = []

  traverse(program, {
    enterExpr(expr) {
      if (expr.kind === "Var") {
        references.push(expr.name)
      }
    },
  })

  return references
}

/**
 * Check if a program contains a specific expression kind
 */
export function hasExpressionKind(program: Program, kind: Expr["kind"]): boolean {
  let found = false

  traverse(program, {
    enterExpr(expr) {
      if (expr.kind === kind) {
        found = true
        return false // Stop traversal
      }
    },
  })

  return found
}

/**
 * Count the number of nodes of a specific type
 */
export function countNodes(program: Program, kind: Expr["kind"] | Stmt["kind"]): number {
  let count = 0

  traverse(program, {
    enterStmt(stmt) {
      if (stmt.kind === kind) count++
    },
    enterExpr(expr) {
      if (expr.kind === kind) count++
    },
  })

  return count
}

/**
 * Get the depth of the AST (maximum nesting level)
 */
export function getASTDepth(program: Program): number {
  let maxDepth = 0
  let currentDepth = 0

  traverse(program, {
    enterStmt() {
      currentDepth++
      maxDepth = Math.max(maxDepth, currentDepth)
    },
    exitStmt() {
      currentDepth--
    },
    enterExpr() {
      currentDepth++
      maxDepth = Math.max(maxDepth, currentDepth)
    },
    exitExpr() {
      currentDepth--
    },
  })

  return maxDepth
}
