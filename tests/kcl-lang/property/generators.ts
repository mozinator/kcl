/**
 * KCL Property Test Generators
 *
 * Generators for creating valid KCL programs, ASTs, and tokens for property testing.
 */

import type { Generator } from "../../property/generator"
import { Gen } from "../../property/generator"
import { Primitives as P } from "../../property/primitives"
import type { Program, Stmt, Expr, Ident } from "../../../src/kcl-lang/ast"
import type { Random } from "./random"

/**
 * Configuration for KCL program generation
 */
export interface KCLConfig {
  maxDepth?: number          // Maximum expression nesting depth
  maxStatements?: number     // Maximum number of statements in program
  allowPipe?: boolean        // Allow pipe operators
  allowBinaryOps?: boolean   // Allow binary operations
  primitiveRatio?: number    // Probability of generating primitive vs complex expr
}

const DEFAULT_CONFIG: Required<KCLConfig> = {
  maxDepth: 3,
  maxStatements: 10,
  allowPipe: true,
  allowBinaryOps: true,
  primitiveRatio: 0.4
}

/**
 * Generate a valid KCL identifier
 */
export const arbIdent: Generator<Ident> = (rng) => {
  const firstChar = rng.pick(["a", "b", "c", "x", "y", "z", "s", "p", "v"])
  const suffix = rng.int(0, 100)
  return `${firstChar}${suffix > 10 ? suffix : ""}`
}

/**
 * Generate a number literal expression
 */
export const arbNumberLit: Generator<Expr> = (rng) => ({
  kind: "Number",
  value: rng.pick([
    rng.int(1, 100),
    rng.float(0.1, 50.0),
    0,
    1,
    10,
    -5
  ])
})

/**
 * Generate a boolean literal expression
 */
export const arbBoolLit: Generator<Expr> = (rng) => ({
  kind: "Bool",
  value: rng.bool()
})

/**
 * Generate a string literal expression
 */
export const arbStringLit: Generator<Expr> = (rng) => ({
  kind: "String",
  value: rng.pick(["", "test", "output.png", "shape1"])
})

/**
 * Generate an array literal (point) expression
 */
export const arbArrayLit: Generator<Expr> = (rng) => {
  const length = rng.pick([2, 3, 3, 3]) // Bias toward 3D points
  const elements: Expr[] = []
  for (let i = 0; i < length; i++) {
    elements.push({ kind: "Number", value: rng.int(-50, 50) })
  }
  return { kind: "Array", elements }
}

/**
 * Generate a range expression
 */
export const arbRangeLit: Generator<Expr> = (rng) => {
  const start = rng.int(0, 10)
  const end = start + rng.int(1, 20)
  const inclusive = rng.bool()
  return {
    kind: "Range",
    start: { kind: "Number", value: start },
    end: { kind: "Number", value: end },
    inclusive
  }
}

/**
 * Generate an object literal expression
 * Supports arbitrary expressions in fields
 */
export const arbObjectLit: Generator<Expr> = (rng) => {
  const numFields = rng.int(1, 4)
  const fields: Record<string, Expr> = {}

  for (let i = 0; i < numFields; i++) {
    const fieldName = rng.pick(["x", "y", "z", "width", "height", "radius", "name", "count"])
    // Use literals and simple expressions
    fields[fieldName] = rng.pick([arbNumberLit, arbStringLit, arbBoolLit])(rng)
  }

  return { kind: "Object", fields }
}

/**
 * Generate an array indexing expression
 */
export function arbArrayIndex(depth: number): Generator<Expr> {
  return (rng) => {
    const array = rng.pick([arbArrayLit, arbRangeLit])(rng)
    const index = { kind: "Number" as const, value: rng.int(0, 2) }
    return { kind: "Index", array, index }
  }
}

/**
 * Generate a member access expression
 */
export function arbMemberAccess(): Generator<Expr> {
  return (rng) => {
    const object = arbObjectLit(rng)
    const member = rng.pick(["x", "y", "z", "width", "height", "radius"])
    return { kind: "MemberAccess", object, member }
  }
}

/**
 * Generate a math function call (sin, cos, sqrt, abs, etc.)
 */
export function arbMathCall(): Generator<Expr> {
  return (rng) => {
    const singleArgFns = ["sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "abs", "round", "floor", "ceil", "log", "log2", "log10"]
    const twoArgFns = ["atan2", "pow", "min", "max"]

    const useSingleArg = rng.bool()

    if (useSingleArg) {
      const fn = rng.pick(singleArgFns)
      const arg = { kind: "Number" as const, value: rng.int(1, 100) } // Positive for safety

      // Determine correct parameter name
      let paramName = "num"
      if (fn === "sqrt" || fn === "abs" || fn === "round" || fn === "floor" || fn === "ceil" || fn.startsWith("log")) {
        paramName = "input"
      }

      return {
        kind: "Call",
        callee: fn,
        args: {
          [paramName]: arg
        }
      }
    } else {
      const fn = rng.pick(twoArgFns)
      const arg1 = { kind: "Number" as const, value: rng.int(1, 100) }
      const arg2 = { kind: "Number" as const, value: rng.int(1, 100) }

      return {
        kind: "Call",
        callee: fn,
        args: fn === "atan2"
          ? { y: arg1, x: arg2 }
          : fn === "pow"
          ? { base: arg1, exponent: arg2 }
          : { a: arg1, b: arg2 }
      }
    }
  }
}

/**
 * Generate a primitive CAD operation call
 * Only uses operations available in KCL stdlib
 */
export function arbPrimitiveCall(): Generator<Expr> {
  return (rng) => {
    // Only box is a primitive in KCL stdlib
    return {
      kind: "Call",
      callee: "box",
      args: {
        width: { kind: "Number", value: rng.int(1, 100) },
        height: { kind: "Number", value: rng.int(1, 100) },
        depth: { kind: "Number", value: rng.int(1, 100) }
      }
    }
  }
}

/**
 * Generate a transform operation call (requires input shape)
 * Only uses operations available in KCL stdlib
 */
export function arbTransformCall(shapeExpr: Expr): Generator<Expr> {
  return (rng) => {
    // Only translate is available in current KCL stdlib
    return {
      kind: "Call",
      callee: "translate",
      args: {
        shape: shapeExpr,
        x: { kind: "Number", value: rng.int(-50, 50) },
        y: { kind: "Number", value: rng.int(-50, 50) },
        z: { kind: "Number", value: rng.int(-50, 50) }
      }
    }
  }
}

/**
 * Generate a binary operation expression
 */
export function arbBinaryOp(depth: number): Generator<Expr> {
  return (rng) => {
    const opType = rng.pick(["arith", "comp", "logic"] as const)

    let op: string
    let left: Expr
    let right: Expr

    switch (opType) {
      case "arith":
        op = rng.pick(["*", "/", "+", "-", "%", "^"] as const)
        left = arbNumberLit(rng)
        right = arbNumberLit(rng)
        break
      case "comp":
        op = rng.pick(["==", "!=", "<", ">", "<=", ">="] as const)
        left = arbNumberLit(rng)
        right = arbNumberLit(rng)
        break
      case "logic":
        op = rng.pick(["&", "|"] as const)
        left = arbBoolLit(rng)
        right = arbBoolLit(rng)
        break
    }

    return { kind: "BinaryOp", op, left, right }
  }
}

/**
 * Generate a comparison expression for conditions
 */
export function arbComparisonExpr(): Generator<Expr> {
  return (rng) => {
    const op = rng.pick(["==", "!=", "<", ">", "<=", ">="] as const)
    const left = arbNumberLit(rng)
    const right = arbNumberLit(rng)
    return { kind: "BinaryOp", op, left, right }
  }
}

/**
 * Generate an if-else expression
 */
export function arbIfExpr(depth: number): Generator<Expr> {
  return (rng) => {
    // Conditions should be bool or comparison expressions
    const condition = rng.bool() ? arbBoolLit(rng) : arbComparisonExpr()(rng)
    const thenBranch = arbExpr(depth - 1, { maxDepth: depth - 1, primitiveRatio: 0.8 })(rng)

    const elseIfBranches: Array<{ condition: Expr; body: Expr }> = []
    const numElseIf = rng.int(0, 2) // 0-2 else-if branches

    for (let i = 0; i < numElseIf; i++) {
      elseIfBranches.push({
        condition: rng.bool() ? arbBoolLit(rng) : arbComparisonExpr()(rng),
        body: arbExpr(depth - 1, { maxDepth: depth - 1, primitiveRatio: 0.8 })(rng)
      })
    }

    const elseBranch = rng.bool()
      ? arbExpr(depth - 1, { maxDepth: depth - 1, primitiveRatio: 0.8 })(rng)
      : undefined

    return { kind: "If", condition, thenBranch, elseIfBranches, elseBranch }
  }
}

/**
 * Generate an arbitrary expression with controlled depth
 */
export function arbExpr(depth: number = 3, config: Partial<KCLConfig> = {}): Generator<Expr> {
  const cfg = { ...DEFAULT_CONFIG, ...config, maxDepth: depth }

  return (rng) => {
    // Base case: depth exhausted or primitive chosen
    if (depth <= 0 || rng.float(0, 1) < cfg.primitiveRatio) {
      return rng.pick([
        arbNumberLit,
        arbBoolLit,
        arbStringLit,
        arbArrayLit,
        arbRangeLit,
        arbObjectLit,
        arbPrimitiveCall()
      ])(rng)
    }

    // Recursive case
    const choices: Generator<Expr>[] = [
      arbNumberLit,
      arbBoolLit,
      arbPrimitiveCall(),
      arbMathCall(),
      arbObjectLit,
      arbRangeLit
    ]

    if (cfg.allowBinaryOps) {
      choices.push(arbBinaryOp(depth))
    }

    // Add complex expressions at lower depth
    if (depth > 1) {
      choices.push(arbArrayIndex(depth))
      choices.push(arbMemberAccess())
      // Add if-else with low probability to avoid generating too many
      if (rng.float(0, 1) < 0.2) {
        choices.push(arbIfExpr(depth))
      }
    }

    return rng.pick(choices)(rng)
  }
}

/**
 * Generate a variable reference
 */
export function arbVarRef(availableVars: Ident[]): Generator<Expr> {
  return (rng) => {
    if (availableVars.length === 0) {
      // Fallback to a literal if no vars available
      return arbNumberLit(rng)
    }
    return { kind: "Var", name: rng.pick(availableVars) }
  }
}

/**
 * Generate a let statement
 */
export function arbLetStmt(depth: number = 3): Generator<Stmt> {
  return (rng) => {
    const name = arbIdent(rng)
    const expr = arbExpr(depth)(rng)
    return { kind: "Let", name, expr }
  }
}

/**
 * Generate a valid KCL program
 */
export function arbProgram(config: Partial<KCLConfig> = {}): Generator<Program> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  return (rng) => {
    const numStmts = rng.int(1, cfg.maxStatements)
    const body: Stmt[] = []
    const definedVars: Ident[] = []

    for (let i = 0; i < numStmts; i++) {
      // Generate a let statement
      const name = arbIdent(rng)

      // Decide what kind of expression
      let expr: Expr
      if (definedVars.length > 0 && rng.float(0, 1) < 0.3) {
        // 30% chance to reference a previous variable (for transforms)
        const varRef: Expr = { kind: "Var", name: rng.pick(definedVars) }
        expr = arbTransformCall(varRef)(rng)
      } else {
        // Otherwise create a new shape or primitive
        expr = arbExpr(cfg.maxDepth, cfg)(rng)
      }

      body.push({ kind: "Let", name, expr })
      definedVars.push(name)
    }

    return { kind: "Program", body }
  }
}

/**
 * Generate a small program (1-5 statements)
 */
export const arbSmallProgram: Generator<Program> = arbProgram({ maxStatements: 5, maxDepth: 2 })

/**
 * Generate a simple program (only primitives and transforms, no binary ops)
 */
export const arbSimpleProgram: Generator<Program> = arbProgram({
  maxStatements: 5,
  maxDepth: 2,
  allowBinaryOps: false,
  allowPipe: false
})

/**
 * Generate a program with binary operations
 */
export const arbProgramWithBinaryOps: Generator<Program> = arbProgram({
  maxStatements: 5,
  maxDepth: 3,
  allowBinaryOps: true,
  primitiveRatio: 0.6
})

/**
 * Generate KCL source code from AST
 * (for round-trip testing)
 */
export function programToSource(program: Program): string {
  const lines: string[] = []

  for (const stmt of program.body) {
    if (stmt.kind === "Let") {
      lines.push(`let ${stmt.name} = ${exprToSource(stmt.expr)}`)
    } else if (stmt.kind === "Assign") {
      lines.push(`${stmt.name} = ${exprToSource(stmt.expr)}`)
    } else {
      lines.push(exprToSource(stmt.expr))
    }
  }

  return lines.join("\n")
}

function exprToSource(expr: Expr): string {
  switch (expr.kind) {
    case "Number":
      return expr.value.toString()

    case "Bool":
      return expr.value.toString()

    case "String":
      return `"${expr.value}"`

    case "Array":
      return `[${expr.elements.map(exprToSource).join(", ")}]`

    case "Object": {
      const fields = Object.entries(expr.fields)
        .map(([name, val]) => `${name} = ${exprToSource(val)}`)
        .join(", ")
      return `{ ${fields} }`
    }

    case "Range": {
      const op = expr.inclusive ? ".." : "..<"
      return `[${exprToSource(expr.start)}${op}${exprToSource(expr.end)}]`
    }

    case "Index":
      return `${exprToSource(expr.array)}[${exprToSource(expr.index)}]`

    case "MemberAccess":
      return `${exprToSource(expr.object)}.${expr.member}`

    case "Var":
      return expr.name

    case "Call": {
      const args = Object.entries(expr.args)
        .map(([name, val]) => {
          // Handle positional argument
          if (name === "$0") {
            return exprToSource(val)
          }
          return `${name}=${exprToSource(val)}`
        })
        .join(", ")
      return `${expr.callee}(${args})`
    }

    case "Pipe":
      return `${exprToSource(expr.left)} |> ${exprToSource(expr.right)}`

    case "UnaryMinus":
      return `-${exprToSource(expr.operand)}`

    case "UnaryNot":
      return `!${exprToSource(expr.operand)}`

    case "BinaryOp":
      return `(${exprToSource(expr.left)} ${expr.op} ${exprToSource(expr.right)})`

    case "TypeAscription":
      return `(${exprToSource(expr.expr)}): ${typeToSource(expr.type)}`

    case "If": {
      let result = `if ${exprToSource(expr.condition)} { ${exprToSource(expr.thenBranch)} }`

      for (const elseIf of expr.elseIfBranches) {
        result += ` else if ${exprToSource(elseIf.condition)} { ${exprToSource(elseIf.body)} }`
      }

      if (expr.elseBranch) {
        result += ` else { ${exprToSource(expr.elseBranch)} }`
      }

      return result
    }

    default:
      return "0"
  }
}

function typeToSource(type: any): string {
  switch (type.kind) {
    case "PrimitiveType":
      return type.name
    case "NumberType":
      return type.suffix ? `number(${type.suffix})` : "number"
    case "ArrayType": {
      const elemType = typeToSource(type.elementType)
      if (type.length) {
        const len = type.length.kind === "Exact"
          ? type.length.value
          : `${type.length.value}+`
        return `[${elemType}; ${len}]`
      }
      return `[${elemType}]`
    }
    case "ObjectType": {
      const fields = type.fields
        .map((f: any) => `${f.name}: ${typeToSource(f.type)}`)
        .join(", ")
      return `{ ${fields} }`
    }
    case "NamedType":
      return type.name
    default:
      return "any"
  }
}

/**
 * Generate a function parameter with various configurations
 */
export function arbParam(rng: Random): {
  name: string
  unlabeled?: boolean
  optional?: boolean
  defaultValue?: Expr
} {
  const name = arbIdent(rng)
  const unlabeled = rng.bool(0.5) // 50% unlabeled
  const optional = rng.bool(0.3) // 30% optional

  return {
    name,
    unlabeled,
    optional,
    defaultValue: optional ? arbNumberLit(rng) : undefined
  }
}

/**
 * Generate a function definition
 */
export function arbFunctionDef(rng: Random, config: KCLConfig = {}): Stmt {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const name = arbIdent(rng)
  const paramCount = rng.int(0, 4)
  const params = Array.from({ length: paramCount }, () => arbParam(rng))

  // Simple function body with 1-3 statements
  const stmtCount = rng.int(1, 3)
  const body: Stmt[] = []

  for (let i = 0; i < stmtCount; i++) {
    body.push({
      kind: "Let",
      name: arbIdent(rng),
      expr: arbNumberLit(rng)
    })
  }

  // Return expression
  const returnExpr = arbNumberLit(rng)

  return {
    kind: "FnDef",
    name,
    params,
    body,
    returnExpr
  }
}

/**
 * Generate a function call with various argument patterns
 */
export function arbFunctionCall(rng: Random, functionName: string, params: any[]): Expr {
  const args: Record<string, Expr> = {}

  let positionalIndex = 0
  for (const param of params) {
    const usePositional = param.unlabeled && rng.bool(0.7)
    const provideArg = !param.optional || rng.bool(0.7)

    if (provideArg) {
      if (usePositional) {
        args[`$${positionalIndex}`] = arbNumberLit(rng)
        positionalIndex++
      } else {
        args[param.name] = arbNumberLit(rng)
      }
    }
  }

  return {
    kind: "Call",
    callee: functionName,
    args
  }
}

/**
 * Generate a tag declarator
 */
export const arbTagDeclarator: Generator<Expr> = (rng) => ({
  kind: "TagDeclarator",
  name: arbIdent(rng)
})
