/**
 * KCL Parser
 *
 * Recursive descent parser that transforms tokens into an AST.
 * Supports let-bindings, function calls with named arguments, and expressions.
 */

import type { Program, Stmt, Expr, TypeAnnotation, ArrayLength, NumericSuffix } from "./ast"
import type { Tok } from "./lexer"
import { DEFAULT_SETTINGS, extractSettings, type FileSettings } from "./settings"

export function parse(tokens: Tok[]): Program {
  let i = 0
  const peek = () => tokens[i]
  const eat = () => tokens[i++]
  const expect = (k: string, v?: string) => {
    const t = eat()
    if (t.k !== k || (v && (t as any).v !== v)) {
      const got = (t as any).v !== undefined ? `${t.k} "${(t as any).v}"` : t.k
      const expected = v ? `${k} "${v}"` : k
      throw new Error(`Expected ${expected}, got ${got} at position ${i - 1}`)
    }
    return t
  }

  function parseAtom(): Expr {
    const t = peek()

    // Handle parenthesized expressions
    if (t.k === "Sym" && (t as any).v === "(") {
      eat() // consume '('
      const expr = parseExpr()
      expect("Sym", ")")
      return expr
    }

    if (t.k === "Num") {
      eat()
      return { kind: "Number", value: t.v, unit: t.unit }
    }

    if (t.k === "Str") {
      eat()
      return { kind: "String", value: t.v }
    }

    // Pipe substitution placeholder: %
    if (t.k === "Sym" && (t as any).v === "%") {
      eat()
      return { kind: "PipeSubstitution" }
    }

    // Tag declarator: $identifier
    if (t.k === "Sym" && (t as any).v === "$") {
      eat() // consume $
      const tagName = expect("Ident").v as string
      return { kind: "TagDeclarator", name: tagName }
    }

    // Object literal: { key = value, key2 = value2 }
    if (t.k === "Sym" && (t as any).v === "{") {
      eat() // consume '{'
      const fields: Record<string, Expr> = {}

      // Check for empty object
      if (peek().k === "Sym" && (peek() as any).v === "}") {
        eat()
        return { kind: "Object", fields }
      }

      // Parse key = value pairs
      while (true) {
        // Allow keywords as object keys (e.g., { fn: ... })
        const keyToken = eat()
        let key: string
        if (keyToken.k === "Ident") {
          key = (keyToken as any).v as string
        } else if (keyToken.k === "Kw") {
          key = (keyToken as any).v as string
        } else {
          throw new Error(`Expected identifier or keyword for object key, got ${keyToken.k}`)
        }

        expect("Sym", "=")
        fields[key] = parseExpr()

        if (peek().k === "Sym" && (peek() as any).v === ",") {
          eat() // consume ','
          // Check for trailing comma
          if (peek().k === "Sym" && (peek() as any).v === "}") {
            break
          }
        } else {
          break
        }
      }

      expect("Sym", "}")
      return { kind: "Object", fields }
    }

    // Array literal or range: [1, 2, 3] or [1..5]
    if (t.k === "Sym" && (t as any).v === "[") {
      eat() // consume '['

      // Check for empty array
      if (peek().k === "Sym" && (peek() as any).v === "]") {
        eat()
        return { kind: "Array", elements: [] }
      }

      const first = parseExpr()

      // Check for range: [start..end] or [start..<end]
      if (peek().k === "Op" && ((peek() as any).v === ".." || (peek() as any).v === "..<")) {
        const rangeOp = (eat() as any).v as ".." | "..<"
        const end = parseExpr()
        expect("Sym", "]")
        return { kind: "Range", start: first, end, inclusive: rangeOp === ".." }
      }

      // Regular array literal
      const elements: Expr[] = [first]
      while (peek().k === "Sym" && (peek() as any).v === ",") {
        eat() // consume ','
        if (peek().k === "Sym" && (peek() as any).v === "]") break // trailing comma
        elements.push(parseExpr())
      }

      expect("Sym", "]")
      return { kind: "Array", elements }
    }

    // If-else expression: if cond { expr } else if cond { expr } else { expr }
    if (t.k === "Kw" && (t as any).v === "if") {
      eat() // consume 'if'
      const condition = parseExpr()
      expect("Sym", "{")
      const thenBranch = parseExpr()
      expect("Sym", "}")

      const elseIfBranches: Array<{ condition: Expr; body: Expr }> = []
      let elseBranch: Expr | undefined = undefined

      // Parse else if / else clauses
      while (peek().k === "Kw" && (peek() as any).v === "else") {
        eat() // consume 'else'

        // Check if this is 'else if'
        if (peek().k === "Kw" && (peek() as any).v === "if") {
          eat() // consume 'if'
          const elseIfCondition = parseExpr()
          expect("Sym", "{")
          const elseIfBody = parseExpr()
          expect("Sym", "}")
          elseIfBranches.push({ condition: elseIfCondition, body: elseIfBody })
        } else {
          // Final 'else' clause
          expect("Sym", "{")
          elseBranch = parseExpr()
          expect("Sym", "}")
          break // No more else clauses after final else
        }
      }

      return { kind: "If", condition, thenBranch, elseIfBranches, elseBranch }
    }

    // Anonymous function expression: fn(@x) { ... }
    if (t.k === "Kw" && (t as any).v === "fn") {
      eat() // consume 'fn'
      expect("Sym", "(")

      const params: Param[] = []

      // Parse parameters
      if (!(peek().k === "Sym" && (peek() as any).v === ")")) {
        while (true) {
          let unlabeled = false

          if (peek().k === "Sym" && (peek() as any).v === "@") {
            eat()
            unlabeled = true
          }

          const paramName = expect("Ident").v as string

          // Check for optional marker (?)
          let optional = false
          if (peek().k === "Sym" && (peek() as any).v === "?") {
            eat() // consume '?'
            optional = true
          }

          // Check for type annotation
          let paramType: TypeAnnotation | undefined = undefined
          if (peek().k === "Sym" && (peek() as any).v === ":") {
            eat()
            paramType = parseType()
          }

          // Check for default value (= expr)
          let defaultValue: Expr | undefined = undefined
          if (peek().k === "Sym" && (peek() as any).v === "=") {
            eat() // consume '='
            defaultValue = parseExpr()
          }

          params.push({ name: paramName, unlabeled, type: paramType, optional, defaultValue })

          if (peek().k === "Sym" && (peek() as any).v === ",") {
            eat()
          } else {
            break
          }
        }
      }

      expect("Sym", ")")

      expect("Sym", "{")

      // Parse function body
      const body: Stmt[] = []
      let returnExpr: Expr | undefined = undefined

      while (!(peek().k === "Sym" && (peek() as any).v === "}")) {
        if (peek().k === "Kw" && (peek() as any).v === "return") {
          eat()
          if (peek().k === "Sym" && (peek() as any).v === "}") {
            break
          }
          returnExpr = parseExpr()
          if (peek().k === "Sym" && (peek() as any).v === ";") {
            eat()
          }
          break
        }

        body.push(parseStmt())

        if (peek().k === "Sym" && (peek() as any).v === ";") {
          eat()
        }
      }

      expect("Sym", "}")

      return {
        kind: "AnonymousFn",
        params,
        body,
        returnExpr,
        returnType: undefined, // TODO: Parse return type annotation if present
      }
    }

    if (t.k === "Ident") {
      let id = (eat() as any).v as string

      // Check for namespace separator :: (e.g., vector::add)
      if (peek().k === "DoubleColon") {
        eat() // consume ::
        const member = expect("Ident")
        if (!member.v) {
          throw new Error("Expected identifier after ::")
        }
        id = `${id}::${(member as any).v}`
      }

      // Check for function call: foo(...) or namespace::foo(...)
      if (peek().k === "Sym" && (peek() as any).v === "(") {
        eat() // consume '('

        const args: Record<string, Expr> = {}

        // Parse arguments (can be positional or named)
        // Positional arguments use keys "$0", "$1", "$2", etc.
        // Handle empty argument list: ()
        if (!(peek().k === "Sym" && (peek() as any).v === ")")) {
          // Check if first argument is positional (not name=value)
          // Lookahead: if we see ident followed by '=', it's named
          const firstToken = peek()
          const secondToken = tokens[i + 1]

          if (
            (firstToken.k === "Ident" || firstToken.k === "Kw") &&
            secondToken &&
            secondToken.k === "Sym" &&
            (secondToken as any).v === "="
          ) {
            // All named arguments
            while (true) {
              // Allow keywords as argument names (e.g., fn = ...)
              const nameToken = eat()
              let name: string
              if (nameToken.k === "Ident") {
                name = (nameToken as any).v as string
              } else if (nameToken.k === "Kw") {
                name = (nameToken as any).v as string
              } else {
                throw new Error(`Expected identifier or keyword for argument name, got ${nameToken.k}`)
              }

              expect("Sym", "=")
              args[name] = parseExpr()

              if (peek().k === "Sym" && (peek() as any).v === ",") {
                eat() // consume ','
              } else {
                break
              }
            }
          } else {
            // Positional arguments (may be followed by named arguments)
            let positionalIndex = 0

            // Parse arguments (positional first, then named)
            while (true) {
              // Lookahead to check if this is a named argument
              const nextToken = peek()
              const followingToken = tokens[i + 1]

              if (
                nextToken.k === "Ident" &&
                followingToken &&
                followingToken.k === "Sym" &&
                (followingToken as any).v === "="
              ) {
                // Named argument
                const name = expect("Ident").v as string
                expect("Sym", "=")
                args[name] = parseExpr()
              } else {
                // Positional argument
                args[`$${positionalIndex}`] = parseExpr()
                positionalIndex++
              }

              if (peek().k === "Sym" && (peek() as any).v === ",") {
                eat() // consume ','
                if (peek().k === "Sym" && (peek() as any).v === ")") break // trailing comma
              } else {
                break
              }
            }
          }
        }

        expect("Sym", ")")
        return { kind: "Call", callee: id, args }
      }

      // Check for boolean literals
      if (id === "true") {
        return { kind: "Bool", value: true }
      }
      if (id === "false") {
        return { kind: "Bool", value: false }
      }

      // Check for nil literal
      if (id === "nil") {
        return { kind: "Nil" }
      }

      // Qualified names (with ::) are only allowed in function calls
      if (id.includes("::")) {
        throw new Error(`Qualified name '${id}' can only be used in function calls, not as a variable`)
      }

      // Just a variable reference
      return { kind: "Var", name: id }
    }

    throw new Error(`Unexpected token ${t.k}`)
  }

  function parsePostfix(): Expr {
    let expr = parseAtom()

    // Handle postfix operators: array indexing and member access
    while (true) {
      const t = peek()

      // Array indexing: arr[index]
      if (t.k === "Sym" && (t as any).v === "[") {
        eat() // consume '['
        const index = parseExpr()
        expect("Sym", "]")
        expr = { kind: "Index", array: expr, index }
        continue
      }

      // Member access: obj.member
      if (t.k === "Sym" && (t as any).v === ".") {
        // Lookahead to avoid consuming '.' that's part of '..' operator
        if (tokens[i + 1] && tokens[i + 1].k === "Op") {
          break
        }
        eat() // consume '.'
        const member = expect("Ident").v as string
        expr = { kind: "MemberAccess", object: expr, member }
        continue
      }

      break
    }

    return expr
  }

  function parseUnary(): Expr {
    const t = peek()

    // Handle unary operators: !, -
    if (t.k === "Sym" && (t as any).v === "!") {
      eat()
      const operand = parseUnary()
      return { kind: "UnaryNot", operand }
    }

    if (t.k === "Sym" && (t as any).v === "-") {
      eat()
      const operand = parseUnary()

      // Optimize: if operand is a number literal, negate it directly
      if (operand.kind === "Number") {
        return { kind: "Number", value: -operand.value }
      }

      return { kind: "UnaryMinus", operand }
    }

    return parsePostfix()
  }

  // Exponentiation is right-associative
  function parseExponentiation(): Expr {
    let left = parseUnary()

    if (peek().k === "Sym" && (peek() as any).v === "^") {
      eat()
      const right = parseExponentiation() // Right-associative recursion
      return { kind: "BinaryOp", op: "^", left, right }
    }

    return left
  }

  function parseMultiplicative(): Expr {
    let left = parseExponentiation()

    // Handle *, /, %
    while (
      peek().k === "Sym" &&
      ((peek() as any).v === "*" || (peek() as any).v === "/" || (peek() as any).v === "%")
    ) {
      const op = (eat() as any).v as "*" | "/" | "%"
      const right = parseExponentiation()
      left = { kind: "BinaryOp", op, left, right }
    }

    return left
  }

  function parseAdditive(): Expr {
    let left = parseMultiplicative()

    // Handle + and - (but only as binary operators, not unary minus)
    while (peek().k === "Sym" && ((peek() as any).v === "+" || (peek() as any).v === "-")) {
      const op = (eat() as any).v as "+" | "-"
      const right = parseMultiplicative()
      left = { kind: "BinaryOp", op, left, right }
    }

    return left
  }

  function parseComparison(): Expr {
    let left = parseAdditive()

    // Handle <, >, <=, >=
    const t = peek()
    if (t.k === "Sym" && ((t as any).v === "<" || (t as any).v === ">")) {
      const op = (eat() as any).v as "<" | ">"
      const right = parseAdditive()
      return { kind: "BinaryOp", op, left, right }
    }
    if (t.k === "Op" && ((t as any).v === "<=" || (t as any).v === ">=")) {
      const op = (eat() as any).v as "<=" | ">="
      const right = parseAdditive()
      return { kind: "BinaryOp", op, left, right }
    }

    return left
  }

  function parseEquality(): Expr {
    let left = parseComparison()

    // Handle ==, !=
    const t = peek()
    if (t.k === "Op" && ((t as any).v === "==" || (t as any).v === "!=")) {
      const op = (eat() as any).v as "==" | "!="
      const right = parseComparison()
      return { kind: "BinaryOp", op, left, right }
    }

    return left
  }

  function parseLogicalAnd(): Expr {
    let left = parseEquality()

    // Handle & (logical AND)
    while (peek().k === "Sym" && (peek() as any).v === "&") {
      eat()
      const right = parseEquality()
      left = { kind: "BinaryOp", op: "&", left, right }
    }

    return left
  }

  function parseLogicalOr(): Expr {
    let left = parseLogicalAnd()

    // Handle | (logical OR) - but not |> pipe operator
    while (peek().k === "Sym" && (peek() as any).v === "|") {
      eat()
      const right = parseLogicalAnd()
      left = { kind: "BinaryOp", op: "|", left, right }
    }

    return left
  }

  function parseExpr(): Expr {
    let left = parseLogicalOr()

    // Handle pipe operator: a |> b
    while (peek().k === "Pipe") {
      eat() // consume '|>'
      const right = parseLogicalOr()
      left = { kind: "Pipe", left, right }
    }

    // Handle type ascription: (expr): Type
    if (peek().k === "Sym" && (peek() as any).v === ":") {
      eat() // consume ':'
      const type = parseType()
      return { kind: "TypeAscription", expr: left, type }
    }

    return left
  }

  function parseType(): TypeAnnotation {
    const t = peek()

    // Array type: [Type] or [Type; n] or [Type; n+]
    if (t.k === "Sym" && (t as any).v === "[") {
      eat() // consume '['
      const elementType = parseType()

      // Check for length constraint
      if (peek().k === "Sym" && (peek() as any).v === ";") {
        eat() // consume ';'

        // Parse number
        const numTok = expect("Num")
        const value = (numTok as any).v as number

        // Check for '+'
        let length: ArrayLength
        if (peek().k === "Sym" && (peek() as any).v === "+") {
          eat() // consume '+'
          length = { kind: "Minimum", value }
        } else {
          length = { kind: "Exact", value }
        }

        expect("Sym", "]")
        return { kind: "ArrayType", elementType, length }
      }

      expect("Sym", "]")
      return { kind: "ArrayType", elementType }
    }

    // Object type: { field: Type, field2: Type }
    if (t.k === "Sym" && (t as any).v === "{") {
      eat() // consume '{'
      const fields: Array<{ name: string; type: TypeAnnotation }> = []

      if (!(peek().k === "Sym" && (peek() as any).v === "}")) {
        while (true) {
          const fieldName = expect("Ident").v as string
          expect("Sym", ":")
          const fieldType = parseType()
          fields.push({ name: fieldName, type: fieldType })

          if (peek().k === "Sym" && (peek() as any).v === ",") {
            eat() // consume ','
            if (peek().k === "Sym" && (peek() as any).v === "}") break // trailing comma
          } else {
            break
          }
        }
      }

      expect("Sym", "}")
      return { kind: "ObjectType", fields }
    }

    // Primitive types or number type
    if (t.k === "Ident") {
      const typename = (eat() as any).v as string

      // Check for number(suffix)
      if (typename === "number" && peek().k === "Sym" && (peek() as any).v === "(") {
        eat() // consume '('
        const suffix = expect("Ident").v as string
        expect("Sym", ")")
        return { kind: "NumberType", suffix: suffix as any }
      }

      // Primitive types
      if (typename === "any" || typename === "none" || typename === "bool" || typename === "string") {
        return { kind: "PrimitiveType", name: typename }
      }

      // Plain number type
      if (typename === "number") {
        return { kind: "NumberType" }
      }

      // Named/custom type
      return { kind: "NamedType", name: typename }
    }

    throw new Error(`Expected type, got ${t.k}`)
  }

  function parseStmt(): Stmt {
    // Import statement: import x from "path" or import "path" as x
    if (peek().k === "Ident" && (peek() as any).v === "import") {
      eat() // consume 'import'

      // Check if it's a string literal (whole module import)
      if (peek().k === "Str") {
        const path = (eat() as any).v as string
        let alias: string | undefined = undefined

        // Check for "as alias"
        if (peek().k === "Ident" && (peek() as any).v === "as") {
          eat() // consume 'as'
          alias = expect("Ident").v as string
        }

        return { kind: "Import", path, alias }
      }

      // Named imports: import x, y from "path"
      const items: ImportItem[] = []

      while (true) {
        const name = expect("Ident").v as string
        let alias: string | undefined = undefined

        // Check for "as alias"
        if (peek().k === "Ident" && (peek() as any).v === "as") {
          eat() // consume 'as'
          alias = expect("Ident").v as string
        }

        items.push({ name, alias })

        if (peek().k === "Sym" && (peek() as any).v === ",") {
          eat() // consume ','
        } else {
          break
        }
      }

      // Expect "from"
      if (peek().k === "Ident" && (peek() as any).v === "from") {
        eat() // consume 'from'
      } else {
        throw new Error(`Expected 'from' after import items`)
      }

      const path = expect("Str").v as string

      return { kind: "Import", path, items }
    }

    // Export statement: export fn/let/value
    if (peek().k === "Ident" && (peek() as any).v === "export") {
      eat() // consume 'export'

      // Check for re-export: export import x from "path"
      if (peek().k === "Ident" && (peek() as any).v === "import") {
        eat() // consume 'import'

        const name = expect("Ident").v as string
        let alias: string | undefined = undefined

        if (peek().k === "Ident" && (peek() as any).v === "as") {
          eat() // consume 'as'
          alias = expect("Ident").v as string
        }

        // Expect "from"
        if (peek().k === "Ident" && (peek() as any).v === "from") {
          eat() // consume 'from'
        } else {
          throw new Error(`Expected 'from' after export import`)
        }

        const path = expect("Str").v as string

        return { kind: "ExportImport", item: { name, alias }, path }
      }

      // Regular export: export fn/let/assign
      const stmt = parseStmt()

      // Validate that the statement can be exported
      if (stmt.kind !== "FnDef" && stmt.kind !== "Let" && stmt.kind !== "Assign") {
        throw new Error(`Only functions and variables can be exported, got ${stmt.kind}`)
      }

      return { kind: "Export", stmt }
    }

    // Annotation: @name(key=value, ...)
    if (peek().k === "Sym" && (peek() as any).v === "@") {
      eat() // consume '@'
      const name = expect("Ident").v as string
      const args: Record<string, Expr> = {}

      // Check if there are arguments
      if (peek().k === "Sym" && (peek() as any).v === "(") {
        eat() // consume '('

        // Parse named arguments
        while (!(peek().k === "Sym" && (peek() as any).v === ")")) {
          const argName = expect("Ident").v as string
          expect("Sym", "=")
          args[argName] = parseExpr()

          if (peek().k === "Sym" && (peek() as any).v === ",") {
            eat() // consume ','
          } else {
            break
          }
        }

        expect("Sym", ")")
      }

      return { kind: "Annotation", name, args }
    }

    // fn name(params) { body } OR fn(params) { body } (anonymous at statement level)
    if (peek().k === "Kw" && (peek() as any).v === "fn") {
      // Check if this is an anonymous function (fn followed by '(') or named function (fn followed by identifier)
      const nextToken = tokens[i + 1]
      if (nextToken && nextToken.k === "Sym" && (nextToken as any).v === "(") {
        // Anonymous function at statement level - parse as expression statement
        const expr = parseExpr()
        return { kind: "ExprStmt", expr }
      }

      // Named function definition
      eat() // consume 'fn'
      const name = expect("Ident").v as string
      expect("Sym", "(")

      const params: Array<{ name: string; unlabeled?: boolean }> = []

      // Parse parameters
      if (!(peek().k === "Sym" && (peek() as any).v === ")")) {
        while (true) {
          let unlabeled = false

          // Check for @ prefix for unlabeled parameter
          if (peek().k === "Sym" && (peek() as any).v === "@") {
            eat() // consume '@'
            unlabeled = true
          }

          const paramName = expect("Ident").v as string

          // Check for optional marker (?)
          let optional = false
          if (peek().k === "Sym" && (peek() as any).v === "?") {
            eat() // consume '?'
            optional = true
          }

          // Check for type annotation
          let paramType: TypeAnnotation | undefined = undefined
          if (peek().k === "Sym" && (peek() as any).v === ":") {
            eat() // consume ':'
            paramType = parseType()
          }

          // Check for default value (= expr)
          let defaultValue: Expr | undefined = undefined
          if (peek().k === "Sym" && (peek() as any).v === "=") {
            eat() // consume '='
            defaultValue = parseExpr()
          }

          params.push({ name: paramName, unlabeled, type: paramType, optional, defaultValue })

          if (peek().k === "Sym" && (peek() as any).v === ",") {
            eat() // consume ','
          } else {
            break
          }
        }
      }

      expect("Sym", ")")

      // Check for return type annotation
      let returnType: TypeAnnotation | undefined = undefined
      if (peek().k === "Sym" && (peek() as any).v === ":") {
        eat() // consume ':'
        returnType = parseType()
      }

      expect("Sym", "{")

      // Parse function body
      const body: Stmt[] = []
      let returnExpr: Expr | undefined = undefined

      while (!(peek().k === "Sym" && (peek() as any).v === "}")) {
        // Check for return statement
        if (peek().k === "Kw" && (peek() as any).v === "return") {
          eat() // consume 'return'
          returnExpr = parseExpr()
          // Optional semicolon after return
          if (peek().k === "Sym" && (peek() as any).v === ";") {
            eat()
          }
          break // return must be last
        }

        body.push(parseStmt())

        // Optional semicolon
        if (peek().k === "Sym" && (peek() as any).v === ";") {
          eat()
        }
      }

      expect("Sym", "}")
      return { kind: "FnDef", name, params, body, returnExpr, returnType }
    }

    // return expr or just return
    if (peek().k === "Kw" && (peek() as any).v === "return") {
      eat() // consume 'return'
      // Check if there's an expression or if it's just 'return' (for none type)
      if (peek().k === "Sym" && ((peek() as any).v === "}" || (peek() as any).v === ";")) {
        return { kind: "Return" }
      }
      const expr = parseExpr()
      return { kind: "Return", expr }
    }

    // let name = expr
    if (peek().k === "Kw" && (peek() as any).v === "let") {
      eat() // consume 'let'
      const name = expect("Ident").v as string
      expect("Sym", "=")
      const expr = parseExpr()
      return { kind: "Let", name, expr }
    }

    // Check for top-level assignment: name = expr (without let)
    if (peek().k === "Ident") {
      const next = tokens[i + 1]
      if (next && next.k === "Sym" && (next as any).v === "=") {
        const name = (eat() as any).v as string
        expect("Sym", "=")
        const expr = parseExpr()
        return { kind: "Assign", name, expr }
      }
    }

    // Expression statement
    return { kind: "ExprStmt", expr: parseExpr() }
  }

  const body: Stmt[] = []

  while (peek().k !== "EOF") {
    body.push(parseStmt())

    // Optional semicolon
    if (peek().k === "Sym" && (peek() as any).v === ";") {
      eat()
    }
  }

  const program = { kind: "Program" as const, body }

  // Apply settings (default units) to the AST
  applySettings(program)

  return program
}

/**
 * Apply @settings to the entire program
 * This sets default units on number literals that don't have explicit units
 */
function applySettings(program: Program): void {
  let settings = { ...DEFAULT_SETTINGS }

  // First pass: collect @settings annotations
  for (const stmt of program.body) {
    if (stmt.kind === "Annotation" && stmt.name === "settings") {
      const extracted = extractSettings(stmt.args)
      settings = { ...settings, ...extracted }
    }
    if (stmt.kind === "Annotation" && stmt.name === "no_std") {
      settings.noStd = true
    }
  }

  // Second pass: apply default units to number literals
  function applyToExpr(expr: Expr): void {
    switch (expr.kind) {
      case "Number":
        // If no unit specified, apply default based on context
        // We can't know if it's length or angle without more context, so we leave it untyped
        // The runtime will need to handle this
        break

      case "Array":
        expr.elements.forEach(applyToExpr)
        break

      case "Object":
        Object.values(expr.fields).forEach(applyToExpr)
        break

      case "Call":
        Object.values(expr.args).forEach(applyToExpr)
        break

      case "Pipe":
        applyToExpr(expr.left)
        applyToExpr(expr.right)
        break

      case "UnaryMinus":
      case "UnaryNot":
        applyToExpr(expr.operand)
        break

      case "BinaryOp":
        applyToExpr(expr.left)
        applyToExpr(expr.right)
        break

      case "Index":
        applyToExpr(expr.array)
        applyToExpr(expr.index)
        break

      case "Range":
        applyToExpr(expr.start)
        applyToExpr(expr.end)
        break

      case "MemberAccess":
        applyToExpr(expr.object)
        break

      case "TypeAscription":
        applyToExpr(expr.expr)
        break

      case "If":
        applyToExpr(expr.condition)
        applyToExpr(expr.thenBranch)
        expr.elseIfBranches.forEach(branch => {
          applyToExpr(branch.condition)
          applyToExpr(branch.body)
        })
        if (expr.elseBranch) {
          applyToExpr(expr.elseBranch)
        }
        break
    }
  }

  function applyToStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case "Let":
      case "Assign":
        applyToExpr(stmt.expr)
        break

      case "FnDef":
        stmt.body.forEach(applyToStmt)
        if (stmt.returnExpr) {
          applyToExpr(stmt.returnExpr)
        }
        stmt.params.forEach(param => {
          if (param.defaultValue) {
            applyToExpr(param.defaultValue)
          }
        })
        break

      case "Return":
        if (stmt.expr) {
          applyToExpr(stmt.expr)
        }
        break

      case "ExprStmt":
        applyToExpr(stmt.expr)
        break

      case "Annotation":
        Object.values(stmt.args).forEach(applyToExpr)
        break

      case "Export":
        applyToStmt(stmt.stmt)
        break
    }
  }

  program.body.forEach(applyToStmt)
}
