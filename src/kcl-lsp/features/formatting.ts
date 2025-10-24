/**
 * Document Formatting Feature
 *
 * Formats KCL code according to style conventions.
 * Uses CST (Concrete Syntax Tree) with trivia for perfect comment preservation.
 */

import type { TextEdit, Range } from "../protocol"
import type { ParseResult } from "../document-manager"
import type { Program, Stmt, Expr, TriviaItem } from "../../kcl-lang/ast"

/**
 * Format a KCL document
 *
 * @param parseResult The parsed document (now includes trivia from CST)
 * @param originalSource Optional - no longer needed but kept for API compatibility
 */
export function formatDocument(parseResult: ParseResult, originalSource?: string): TextEdit[] {
  if (!parseResult.success) {
    return []
  }

  const formatted = formatProgram(parseResult.program)

  // Return a single edit that replaces the entire document
  const lastLine = parseResult.lineOffsets.length - 1

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
 * Emit trivia items as formatted lines
 */
function emitTrivia(trivia: TriviaItem[], lines: string[]): void {
  for (const item of trivia) {
    if (item.type === 'comment') {
      lines.push(item.text)
    } else if (item.type === 'blank') {
      // Normalize blank lines: max 2
      const count = Math.min(item.count, 2)
      for (let i = 0; i < count; i++) {
        lines.push('')
      }
    }
  }
}

/**
 * Format a program with trivia (CST-based)
 */
function formatProgram(program: Program): string {
  const lines: string[] = []
  let hasOutputContent = false

  // Emit file header trivia (comments only, skip leading blanks)
  if (program.leadingTrivia && program.leadingTrivia.length > 0) {
    for (const item of program.leadingTrivia) {
      if (item.type === 'comment') {
        lines.push(item.text)
        hasOutputContent = true
      }
      // Skip leading blank lines at start of file
    }
  }

  for (let i = 0; i < program.body.length; i++) {
    const stmt = program.body[i]
    const nextStmt = program.body[i + 1]

    // Emit leading trivia (comments and blank lines)
    if (stmt.trivia?.leading && stmt.trivia.leading.length > 0) {
      emitTrivia(stmt.trivia.leading, lines)
      hasOutputContent = true
    }

    // Format the statement
    const formatted = formatStatement(stmt, 0)

    // Add trailing comment on same line if present
    if (stmt.trivia?.trailing && stmt.trivia.trailing.type === 'comment') {
      lines.push(formatted + '  ' + stmt.trivia.trailing.text)
    } else {
      lines.push(formatted)
    }
    hasOutputContent = true
  }

  // Remove trailing blank lines and ensure single trailing newline
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop()
  }

  return lines.join("\n") + "\n"
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
      const bodyLines: string[] = []
      for (const bodyStmt of stmt.body) {
        // Emit leading trivia for body statement (comments, blanks)
        if (bodyStmt.trivia?.leading) {
          for (const item of bodyStmt.trivia.leading) {
            if (item.type === 'comment') {
              bodyLines.push("  ".repeat(indent + 1) + item.text)
            } else if (item.type === 'blank') {
              for (let i = 0; i < Math.min(item.count, 2); i++) {
                bodyLines.push('')
              }
            }
          }
        }

        // Format the statement
        const formatted = formatStatement(bodyStmt, indent + 1)

        // Add trailing comment if present
        if (bodyStmt.trivia?.trailing && bodyStmt.trivia.trailing.type === 'comment') {
          bodyLines.push(formatted + '  ' + bodyStmt.trivia.trailing.text)
        } else {
          bodyLines.push(formatted)
        }
      }

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
        .map(([key, value]) => {
          // Positional arguments use keys like $0, $1, $2
          // Format them without the key name
          if (/^\$\d+$/.test(key)) {
            return formatExpression(value)
          }
          // Named arguments
          return `${key} = ${formatExpression(value)}`
        })

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
      let result = `if ${formatExpression(expr.condition)} { ${formatExpression(expr.thenBranch)} }`

      for (const branch of expr.elseIfBranches) {
        result += ` else if ${formatExpression(branch.condition)} { ${formatExpression(branch.body)} }`
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
