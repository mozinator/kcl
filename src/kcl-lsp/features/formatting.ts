/**
 * Document Formatting Feature
 *
 * Formats KCL code according to style conventions.
 */

import type { TextEdit, Range } from "../protocol"
import type { ParseResult } from "../document-manager"
import type { Program, Stmt, Expr } from "../../kcl-lang/ast"

/**
 * Format a KCL document
 */
export function formatDocument(parseResult: ParseResult): TextEdit[] {
  if (!parseResult.success) {
    return []
  }

  const formatted = formatProgram(parseResult.program)

  // Return a single edit that replaces the entire document
  const lastLine = parseResult.lineOffsets.length - 1
  const lastLineOffset = parseResult.lineOffsets[lastLine]

  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: lastLine + 1, character: 0 },
      },
      newText: formatted,
    },
  ]
}

/**
 * Format a program
 */
function formatProgram(program: Program): string {
  const lines: string[] = []

  for (let i = 0; i < program.body.length; i++) {
    const stmt = program.body[i]
    const formatted = formatStatement(stmt, 0)
    lines.push(formatted)

    // Add blank line after function definitions (except at end)
    if (stmt.kind === "FnDef" && i < program.body.length - 1) {
      lines.push("")
    }

    // Add blank line between different statement types
    if (i < program.body.length - 1) {
      const nextStmt = program.body[i + 1]
      if (shouldAddBlankLine(stmt, nextStmt)) {
        lines.push("")
      }
    }
  }

  return lines.join("\n") + "\n"
}

/**
 * Determine if a blank line should be added between statements
 */
function shouldAddBlankLine(current: Stmt, next: Stmt): boolean {
  // Blank line after function definitions
  if (current.kind === "FnDef") {
    return true
  }

  // Blank line before function definitions
  if (next.kind === "FnDef") {
    return true
  }

  // Blank line after imports
  if (current.kind === "Import" && next.kind !== "Import") {
    return true
  }

  return false
}

/**
 * Format a statement with indentation
 */
function formatStatement(stmt: Stmt, indent: number): string {
  const indentStr = "  ".repeat(indent)

  switch (stmt.kind) {
    case "Let":
      return `${indentStr}let ${stmt.name} = ${formatExpression(stmt.expr)}`

    case "Assign":
      return `${indentStr}${stmt.name} = ${formatExpression(stmt.expr)}`

    case "FnDef": {
      const params = stmt.params.map(p => {
        const prefix = p.unlabeled ? "@" : ""
        const suffix = p.optional ? "?" : ""
        const typeAnnotation = p.type ? `: ${formatType(p.type)}` : ""
        return `${prefix}${p.name}${typeAnnotation}${suffix}`
      }).join(", ")

      const returnType = stmt.returnType ? `: ${formatType(stmt.returnType)}` : ""

      // Single-expression functions CAN stay on one line if very simple
      if (stmt.body.length === 0 && stmt.returnExpr) {
        const returnExpr = formatExpression(stmt.returnExpr)
        // Use single line only for very simple expressions
        if (returnExpr.length < 40 && !returnExpr.includes('\n')) {
          return `${indentStr}fn ${stmt.name}(${params})${returnType} { return ${returnExpr} }`
        }

        // Otherwise multi-line
        return `${indentStr}fn ${stmt.name}(${params})${returnType} {\n${"  ".repeat(indent + 1)}return ${returnExpr}\n${indentStr}}`
      }

      // Multi-line function with body statements
      const bodyLines = stmt.body.map(s => formatStatement(s, indent + 1))
      if (stmt.returnExpr) {
        bodyLines.push(`${"  ".repeat(indent + 1)}return ${formatExpression(stmt.returnExpr)}`)
      }

      // If body is empty, still use multi-line for consistency
      if (bodyLines.length === 0 && !stmt.returnExpr) {
        return `${indentStr}fn ${stmt.name}(${params})${returnType} {\n${"  ".repeat(indent + 1)}// TODO\n${indentStr}}`
      }

      return `${indentStr}fn ${stmt.name}(${params})${returnType} {\n${bodyLines.join("\n")}\n${indentStr}}`
    }

    case "Return":
      if (stmt.expr) {
        return `${indentStr}return ${formatExpression(stmt.expr)}`
      }
      return `${indentStr}return`

    case "ExprStmt":
      return `${indentStr}${formatExpression(stmt.expr)}`

    case "Import": {
      if (stmt.items && stmt.items.length > 0) {
        const items = stmt.items.map(item => {
          if (item.alias) {
            return `${item.name} as ${item.alias}`
          }
          return item.name
        }).join(", ")
        return `${indentStr}import ${items} from "${stmt.path}"`
      }
      if (stmt.alias) {
        return `${indentStr}import "${stmt.path}" as ${stmt.alias}`
      }
      return `${indentStr}import "${stmt.path}"`
    }

    case "Export":
      return formatStatement(stmt.stmt, indent).replace(indentStr, `${indentStr}export `)

    default:
      return `${indentStr}// Unknown statement`
  }
}

/**
 * Format an expression
 */
function formatExpression(expr: Expr): string {
  switch (expr.kind) {
    case "Number":
      return expr.unit ? `${expr.value}${expr.unit}` : expr.value.toString()

    case "Bool":
      return expr.value.toString()

    case "String":
      return `"${expr.value}"`

    case "Nil":
      return "nil"

    case "Var":
      return expr.name

    case "Call": {
      const args = Object.entries(expr.args)
        .map(([key, value]) => `${key} = ${formatExpression(value)}`)

      const argsStr = args.join(", ")

      // If the call is short, keep it on one line
      if (argsStr.length < 60) {
        return `${expr.callee}(${argsStr})`
      }

      // For long calls, format with one argument per line
      const formattedArgs = args.join(",\n  ")
      return `${expr.callee}(\n  ${formattedArgs}\n)`
    }

    case "Pipe":
      return `${formatExpression(expr.left)} |> ${formatExpression(expr.right)}`

    case "PipeSubstitution":
      return "%"

    case "TagDeclarator":
      return `$${expr.name}`

    case "UnaryMinus":
      return `-${formatExpression(expr.operand)}`

    case "UnaryNot":
      return `!${formatExpression(expr.operand)}`

    case "BinaryOp":
      return `${formatExpression(expr.left)} ${expr.op} ${formatExpression(expr.right)}`

    case "Index":
      return `${formatExpression(expr.array)}[${formatExpression(expr.index)}]`

    case "MemberAccess":
      return `${formatExpression(expr.object)}.${expr.member}`

    case "Array": {
      const elements = expr.elements.map(e => formatExpression(e))
      const elementsStr = elements.join(", ")

      // Keep short arrays on one line
      if (elementsStr.length < 40) {
        return `[${elementsStr}]`
      }

      // Format long arrays with one element per line
      const formattedElements = elements.join(",\n  ")
      return `[\n  ${formattedElements}\n]`
    }

    case "Object": {
      const fields = Object.entries(expr.fields)
        .map(([key, value]) => `${key} = ${formatExpression(value)}`)

      const fieldsStr = fields.join(", ")

      // Keep short objects on one line
      if (fieldsStr.length < 40) {
        return `{ ${fieldsStr} }`
      }

      // Format long objects with one field per line
      const formattedFields = fields.join(",\n  ")
      return `{\n  ${formattedFields}\n}`
    }

    case "Range": {
      const op = expr.inclusive ? ".." : "..<"
      return `[${formatExpression(expr.start)}${op}${formatExpression(expr.end)}]`
    }

    case "If": {
      let result = `if (${formatExpression(expr.condition)}) { ${formatExpression(expr.thenBranch)} }`

      for (const branch of expr.elseIfBranches) {
        result += ` else if (${formatExpression(branch.condition)}) { ${formatExpression(branch.body)} }`
      }

      if (expr.elseBranch) {
        result += ` else { ${formatExpression(expr.elseBranch)} }`
      }

      return result
    }

    default:
      return "?"
  }
}

/**
 * Format a type annotation
 */
function formatType(type: any): string {
  switch (type.kind) {
    case "PrimitiveType":
      return type.name

    case "NumberType":
      return type.suffix ? `number${type.suffix}` : "number"

    case "ArrayType": {
      const elemType = formatType(type.elementType)
      if (type.length) {
        if (type.length.kind === "Exact") {
          return `[${elemType}; ${type.length.value}]`
        } else {
          return `[${elemType}; ${type.length.value}+]`
        }
      }
      return `[${elemType}]`
    }

    case "ObjectType": {
      const fields = type.fields.map((f: any) => `${f.name}: ${formatType(f.type)}`).join(", ")
      return `{ ${fields} }`
    }

    case "NamedType":
      return type.name

    default:
      return "?"
  }
}
