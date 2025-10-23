/**
 * KCL Type Checker
 *
 * Validates types of expressions and statements against the standard library.
 * Ensures all operations receive correct argument types before lowering to SSA.
 */

import { OPS, PLANES, MATH_CONSTANTS, UNIT_CONSTANTS } from "./stdlib"
import type { Program, Expr, Stmt } from "./ast"
import { areUnitsCompatible, getUnitName } from "./units"

type Ty = "Shape" | "Scalar" | "Void" | "Sketch" | "Point" | "Plane" | "Object" | "Tag"
type Env = Map<string, Ty>

export function typecheck(prog: Program): void {
  let env: Env = new Map()
  const userFunctions = new Map<string, { params: any[]; returnType: Ty }>()

  const tcExpr = (e: Expr): Ty => {
    switch (e.kind) {
      case "Number":
        return "Scalar"

      case "Bool":
        return "Scalar"

      case "String":
        return "Scalar"

      case "Nil":
        return "Void"

      case "UnaryMinus": {
        const operandTy = tcExpr(e.operand)
        if (operandTy !== "Scalar") {
          throw new Error(`Unary minus requires Scalar operand, got ${operandTy}`)
        }
        return "Scalar"
      }

      case "UnaryNot": {
        const operandTy = tcExpr(e.operand)
        if (operandTy !== "Scalar") {
          throw new Error(`Logical NOT requires Scalar operand, got ${operandTy}`)
        }
        return "Scalar"
      }

      case "BinaryOp": {
        const leftTy = tcExpr(e.left)
        const rightTy = tcExpr(e.right)

        // All binary operators require Scalar operands
        if (leftTy !== "Scalar" || rightTy !== "Scalar") {
          throw new Error(`Binary operator '${e.op}' requires Scalar operands, got ${leftTy} ${e.op} ${rightTy}`)
        }

        // Check unit compatibility for arithmetic operations
        if (e.left.kind === "Number" && e.right.kind === "Number") {
          const leftUnit = e.left.unit
          const rightUnit = e.right.unit

          // For +, -, comparisons: units must be compatible
          if (["+", "-", "==", "!=", "<", ">", "<=", ">="].includes(e.op)) {
            if (!areUnitsCompatible(leftUnit, rightUnit)) {
              const leftName = leftUnit ? getUnitName(leftUnit) : "unitless"
              const rightName = rightUnit ? getUnitName(rightUnit) : "unitless"
              throw new Error(
                `Cannot ${e.op === "+" || e.op === "-" ? "add/subtract" : "compare"} values with incompatible units: ${leftName} ${e.op} ${rightName}`
              )
            }
          }
        }

        // Comparison and logical operators return boolean (Scalar)
        // Arithmetic operators return Scalar
        return "Scalar"
      }

      case "Index": {
        const arrayTy = tcExpr(e.array)
        const indexTy = tcExpr(e.index)

        if (arrayTy !== "Point") {
          throw new Error(`Array indexing requires a Point (array), got ${arrayTy}`)
        }
        if (indexTy !== "Scalar") {
          throw new Error(`Array index must be Scalar, got ${indexTy}`)
        }

        return "Scalar"
      }

      case "Range": {
        const startTy = tcExpr(e.start)
        const endTy = tcExpr(e.end)

        if (startTy !== "Scalar") {
          throw new Error(`Range start must be Scalar, got ${startTy}`)
        }
        if (endTy !== "Scalar") {
          throw new Error(`Range end must be Scalar, got ${endTy}`)
        }

        // Range creates an array of numbers (Point type)
        return "Point"
      }

      case "Object": {
        // Type check all field values
        for (const [key, value] of Object.entries(e.fields)) {
          tcExpr(value) // Just validate the expression, don't use the type for now
        }
        return "Object"
      }

      case "MemberAccess": {
        const objectTy = tcExpr(e.object)
        if (objectTy !== "Object") {
          throw new Error(`Member access requires an Object, got ${objectTy}`)
        }
        // We can't determine the type of the member without a more sophisticated type system
        // For now, assume it's a Scalar
        return "Scalar"
      }

      case "Array": {
        // Arrays can contain different types
        // If all elements are Scalar, it's a Point (numeric vector)
        // Otherwise, it's a generic array
        let allScalar = true
        for (const elem of e.elements) {
          const t = tcExpr(elem)
          if (t !== "Scalar") {
            allScalar = false
          }
        }
        // Return Point for numeric arrays, Object for mixed/tagged arrays
        return allScalar ? "Point" : "Object"
      }

      case "PipeSubstitution": {
        // Pipe substitution (%) inherits type from pipe context
        // For now, assume it's valid - proper implementation would track pipe context
        return "Scalar" // Default to Scalar, will be replaced during SSA lowering
      }

      case "TagDeclarator": {
        // Tag declarators ($identifier) are references to tagged entities
        return "Tag"
      }

      case "Var": {
        // Check for plane constants
        if (e.name in PLANES) {
          return "Plane"
        }

        // Check for math constants
        if (e.name in MATH_CONSTANTS) {
          return "Scalar"
        }

        // Check for unit constants
        if (e.name in UNIT_CONSTANTS) {
          return "Scalar"
        }

        const t = env.get(e.name)
        if (!t) throw new Error(`Unknown variable: ${e.name}`)
        return t
      }

      case "Pipe": {
        // a |> b: The left side produces a value, the right side uses it (via % or as first arg)
        const leftTy = tcExpr(e.left)

        // If right side is a call, validate the piped value matches
        if (e.right.kind === "Call") {
          const call = e.right
          const sig = OPS[call.callee]
          if (!sig) throw new Error(`Unknown operation: ${call.callee}`)

          // The first parameter should accept the piped value
          if (sig.params.length === 0) {
            throw new Error(`Operation '${call.callee}' cannot be used with pipe (no parameters)`)
          }

          const firstParam = sig.params[0]
          if (leftTy !== firstParam.ty) {
            throw new Error(
              `Pipe type mismatch: left produces ${leftTy}, but '${call.callee}' expects ${firstParam.ty}`,
            )
          }

          // Type check the remaining arguments
          for (const [argName, argExpr] of Object.entries(call.args)) {
            const param = sig.params.find((p) => p.name === argName)
            if (!param) {
              throw new Error(`Unknown argument '${argName}' for operation '${call.callee}'`)
            }

            const got = tcExpr(argExpr)
            if (got !== param.ty) {
              throw new Error(
                `Type mismatch for argument '${argName}' in '${call.callee}': expected ${param.ty}, got ${got}`,
              )
            }
          }

          return sig.ret
        } else {
          // Right side is not a call - it can use % placeholder
          // Type check the right side (% will type as Scalar by default)
          return tcExpr(e.right)
        }
      }

      case "Call": {
        // Check if it's a user-defined function first
        const userFn = userFunctions.get(e.callee)
        if (userFn) {
          // Typecheck user function call

          // Count positional arguments ($0, $1, $2, ...)
          let positionalCount = 0
          while (`$${positionalCount}` in e.args) {
            positionalCount++
          }

          // Count required parameters (non-optional ones)
          const requiredParams = userFn.params.filter((p: any) => !p.optional && !p.defaultValue)

          // Count named arguments (excluding positional ones)
          const namedArgCount = Object.keys(e.args).filter(k => !k.startsWith('$')).length

          // Total arguments provided
          const totalArgsProvided = positionalCount + namedArgCount

          // Check if we have enough arguments
          if (totalArgsProvided < requiredParams.length) {
            throw new Error(`Function '${e.callee}' requires at least ${requiredParams.length} arguments, got ${totalArgsProvided}`)
          }

          // Typecheck all argument expressions
          for (const argExpr of Object.values(e.args)) {
            tcExpr(argExpr)
          }

          return userFn.returnType
        }

        // Otherwise check stdlib
        const sig = OPS[e.callee]
        if (!sig) throw new Error(`Unknown operation: ${e.callee}`)

        // Special handling for N-ary fuse
        if (e.callee === "fuse") {
          // fuse accepts any number of Shape arguments
          for (const [argName, argExpr] of Object.entries(e.args)) {
            const got = tcExpr(argExpr)
            if (got !== "Shape") {
              throw new Error(
                `Type mismatch for argument '${argName}' in 'fuse': expected Shape, got ${got}`,
              )
            }
          }
          if (Object.keys(e.args).length < 2) {
            throw new Error("fuse requires at least 2 arguments")
          }
          return "Shape"
        }

        // Validate all required parameters are provided
        for (const p of sig.params) {
          if (!p.optional && !(p.name in e.args)) {
            throw new Error(`Missing argument '${p.name}' for operation '${e.callee}'`)
          }
        }

        // Validate argument types
        for (const [argName, argExpr] of Object.entries(e.args)) {
          const param = sig.params.find((p) => p.name === argName)
          if (!param) {
            throw new Error(`Unknown argument '${argName}' for operation '${e.callee}'`)
          }

          const got = tcExpr(argExpr)
          if (got !== param.ty) {
            throw new Error(
              `Type mismatch for argument '${argName}' in '${e.callee}': expected ${param.ty}, got ${got}`,
            )
          }
        }

        return sig.ret
      }

      case "If": {
        // Type check the condition
        const condTy = tcExpr(e.condition)
        if (condTy !== "Scalar") {
          throw new Error(`If condition must be boolean (Scalar), got ${condTy}`)
        }

        // Type check the then branch
        const thenTy = tcExpr(e.thenBranch)

        // Type check all else-if branches
        for (const elseIfBranch of e.elseIfBranches) {
          const elseIfCondTy = tcExpr(elseIfBranch.condition)
          if (elseIfCondTy !== "Scalar") {
            throw new Error(`Else-if condition must be boolean (Scalar), got ${elseIfCondTy}`)
          }
          const elseIfBodyTy = tcExpr(elseIfBranch.body)
          // All branches should have compatible types (for simplicity, we just check them)
        }

        // Type check the else branch if present
        if (e.elseBranch) {
          const elseTy = tcExpr(e.elseBranch)
          // All branches should have compatible types
        }

        // Return the type of the then branch (all branches should be compatible)
        return thenTy
      }
    }
  }

  // First pass: register all function definitions
  for (const s of prog.body) {
    if (s.kind === "FnDef") {
      // Register function signature
      userFunctions.set(s.name, {
        params: s.params,
        returnType: "Scalar" // For now, assume all functions return Scalar
      })
    }
  }

  // Second pass: typecheck everything
  for (const s of prog.body) {
    if (s.kind === "Import") {
      // Imports are handled at module level, skip for now
      // Type information will be resolved during module compilation
      continue
    } else if (s.kind === "Export") {
      // Typecheck the wrapped statement
      const wrapped = s.stmt
      if (wrapped.kind === "FnDef") {
        // Register exported function
        userFunctions.set(wrapped.name, {
          params: wrapped.params,
          returnType: "Scalar"
        })
        // Continue to typecheck the function below
      } else if (wrapped.kind === "Let") {
        const t = tcExpr(wrapped.expr)
        env.set(wrapped.name, t)
        continue
      } else if (wrapped.kind === "Assign") {
        const t = tcExpr(wrapped.expr)
        env.set(wrapped.name, t)
        continue
      }

      // For FnDef, fall through to normal function processing
      if (wrapped.kind !== "FnDef") continue

      // Process as normal FnDef
      const fnStmt = wrapped
      const fnEnv = new Map(env)
      for (const param of fnStmt.params) {
        fnEnv.set(param.name, "Scalar")
      }
      const oldEnv = env
      env = fnEnv
      for (const stmt of fnStmt.body) {
        if (stmt.kind === "Let") {
          const t = tcExpr(stmt.expr)
          env.set(stmt.name, t)
        } else if (stmt.kind === "Return") {
          if (stmt.expr) {
            tcExpr(stmt.expr)
          }
        } else {
          tcExpr((stmt as any).expr)
        }
      }
      if (fnStmt.returnExpr) {
        tcExpr(fnStmt.returnExpr)
      }
      env = oldEnv
      continue
    } else if (s.kind === "ExportImport") {
      // Re-exports are validated at module level
      continue
    } else if (s.kind === "Annotation") {
      // Typecheck annotation arguments
      for (const argExpr of Object.values(s.args)) {
        tcExpr(argExpr)
      }
      // Annotations don't affect environment
    } else if (s.kind === "Let") {
      const t = tcExpr(s.expr)
      env.set(s.name, t)
    } else if (s.kind === "Assign") {
      const t = tcExpr(s.expr)
      env.set(s.name, t)
    } else if (s.kind === "FnDef") {
      // Typecheck function body
      // Create new scope with parameters
      const fnEnv = new Map(env)
      for (const param of s.params) {
        fnEnv.set(param.name, "Scalar") // Assume all params are Scalar for now
      }

      // Save old env and use function env
      const oldEnv = env
      env = fnEnv

      // Typecheck function body statements
      for (const stmt of s.body) {
        if (stmt.kind === "Let") {
          const t = tcExpr(stmt.expr)
          env.set(stmt.name, t)
        } else if (stmt.kind === "Return") {
          if (stmt.expr) {
            tcExpr(stmt.expr)
          }
        } else {
          // ExprStmt
          tcExpr((stmt as any).expr)
        }
      }

      // Typecheck return expression if present
      if (s.returnExpr) {
        tcExpr(s.returnExpr)
      }

      // Restore old env
      env = oldEnv
    } else if (s.kind === "Return") {
      if (s.expr) {
        tcExpr(s.expr)
      }
    } else {
      // ExprStmt
      tcExpr(s.expr)
    }
  }
}
