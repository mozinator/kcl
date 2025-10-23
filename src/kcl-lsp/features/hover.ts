/**
 * Hover Feature
 *
 * Provides hover information for symbols.
 */

import type { Position, Hover } from "../protocol"
import type { ParseResult } from "../document-manager"
import { OPS, PLANES, MATH_CONSTANTS, UNIT_CONSTANTS } from "../../kcl-lang/stdlib"
import { isPositionInRange } from "../positions"

export function getHover(parseResult: ParseResult, position: Position): Hover | null {
  if (!parseResult.success) {
    return null
  }

  // Find the token at the cursor position
  const token = parseResult.tokens.find(t => isPositionInRange(position, t.range))

  if (!token) {
    return null
  }

  // Handle identifiers
  if (token.k === "Ident") {
    const name = token.v

    // Check if it's a stdlib function
    if (name in OPS) {
      const op = OPS[name]
      const params = op.params || []
      const paramStr = params.map((p: any) => `${p.name}: ${p.type || "any"}`).join(", ")

      return {
        contents: {
          kind: "markdown",
          value: `**${name}**\n\n\`\`\`kcl\nfn(${paramStr})\n\`\`\`\n\n${op.description || ""}`,
        },
        range: token.range,
      }
    }

    // Check if it's a plane constant
    if (name in PLANES) {
      return {
        contents: {
          kind: "markdown",
          value: `**${name}**\n\nPlane constant`,
        },
        range: token.range,
      }
    }

    // Check if it's a math constant
    if (name in MATH_CONSTANTS) {
      const value = MATH_CONSTANTS[name]
      return {
        contents: {
          kind: "markdown",
          value: `**${name}**\n\nMath constant: \`${value}\``,
        },
        range: token.range,
      }
    }

    // Check if it's a unit constant
    if (name in UNIT_CONSTANTS) {
      const value = UNIT_CONSTANTS[name]
      return {
        contents: {
          kind: "markdown",
          value: `**${name}**\n\nUnit constant: \`${value}\``,
        },
        range: token.range,
      }
    }

    // Check if it's a local variable
    const varInfo = findVariableInProgram(parseResult.program, name)
    if (varInfo) {
      return {
        contents: {
          kind: "markdown",
          value: `**${name}**\n\nVariable`,
        },
        range: token.range,
      }
    }
  }

  // Handle numbers
  if (token.k === "Num") {
    const unit = token.unit ? ` ${token.unit}` : ""
    return {
      contents: {
        kind: "markdown",
        value: `Number: \`${token.v}${unit}\``,
      },
      range: token.range,
    }
  }

  // Handle strings
  if (token.k === "Str") {
    return {
      contents: {
        kind: "markdown",
        value: `String: \`"${token.v}"\``,
      },
      range: token.range,
    }
  }

  // Handle keywords
  if (token.k === "Kw") {
    return {
      contents: {
        kind: "markdown",
        value: `Keyword: \`${token.v}\``,
      },
      range: token.range,
    }
  }

  return null
}

function findVariableInProgram(program: any, name: string): boolean {
  for (const stmt of program.body) {
    if (stmt.kind === "Let" && stmt.name === name) {
      return true
    }
    if (stmt.kind === "FnDef" && stmt.name === name) {
      return true
    }
  }
  return false
}
