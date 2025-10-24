/**
 * KCL AST Type Definitions
 *
 * Abstract Syntax Tree types for the KCL CAD language.
 * Immutable let-bindings map directly to SSA form.
 *
 * Trivia (comments, whitespace, blank lines) can be attached to nodes
 * for lossless formatting and source code preservation.
 */

export type Ident = string

// ============================================================================
// Trivia Types (for CST - Concrete Syntax Tree support)
// ============================================================================

/**
 * A single trivia item (comment or blank line sequence)
 */
export type TriviaItem =
  | { type: 'comment'; text: string; isBlock: boolean }
  | { type: 'blank'; count: number }

/**
 * Trivia attached to an AST node
 * - leading: comments and blank lines before the node
 * - trailing: inline comment after the node (same line)
 */
export type Trivia = {
  leading: TriviaItem[]
  trailing?: TriviaItem
}

// ============================================================================
// Core AST Types
// ============================================================================

export type NumberLit = { kind: "Number"; value: number; unit?: NumericSuffix }
export type BoolLit = { kind: "Bool"; value: boolean }
export type StringLit = { kind: "String"; value: string }
export type NilLit = { kind: "Nil" }
export type ArrayLit = { kind: "Array"; elements: Expr[] }
export type ObjectLit = { kind: "Object"; fields: Record<string, Expr> }

export type Expr =
  | NumberLit
  | BoolLit
  | StringLit
  | NilLit
  | ArrayLit
  | ObjectLit
  | { kind: "Var"; name: Ident }
  | { kind: "Call"; callee: Ident; args: Record<string, Expr> }
  | { kind: "Pipe"; left: Expr; right: Expr } // a |> b
  | { kind: "PipeSubstitution" } // % (placeholder for piped value)
  | { kind: "TagDeclarator"; name: Ident } // $identifier (tag reference)
  | { kind: "UnaryMinus"; operand: Expr } // -expr
  | { kind: "UnaryNot"; operand: Expr } // !expr
  | { kind: "BinaryOp"; op: ArithOp | CompOp | LogicOp; left: Expr; right: Expr }
  | { kind: "Index"; array: Expr; index: Expr } // arr[i]
  | { kind: "Range"; start: Expr; end: Expr; inclusive: boolean } // [1..5] or [1..<5]
  | { kind: "MemberAccess"; object: Expr; member: Ident } // obj.key
  | { kind: "TypeAscription"; expr: Expr; type: TypeAnnotation } // (expr): Type
  | { kind: "If"; condition: Expr; thenBranch: Expr; elseIfBranches: Array<{ condition: Expr; body: Expr }>; elseBranch?: Expr } // if-else expression
  | { kind: "AnonymousFn"; params: Param[]; body: Stmt[]; returnExpr?: Expr; returnType?: TypeAnnotation } // fn(@x) { ... }

// Arithmetic operators
export type ArithOp = "+" | "-" | "*" | "/" | "%" | "^"

// Comparison operators
export type CompOp = "==" | "!=" | "<" | ">" | "<=" | ">="

// Logical operators
export type LogicOp = "&" | "|"

export type Param = {
  name: Ident
  unlabeled?: boolean // true if prefixed with @
  type?: TypeAnnotation // optional type annotation
  optional?: boolean // true if suffixed with ?
  defaultValue?: Expr // default value if optional
}

// Type annotations
export type TypeAnnotation =
  | { kind: "PrimitiveType"; name: "any" | "none" | "bool" | "string" }
  | { kind: "NumberType"; suffix?: NumericSuffix }
  | { kind: "ArrayType"; elementType: TypeAnnotation; length?: ArrayLength }
  | { kind: "ObjectType"; fields: Array<{ name: string; type: TypeAnnotation }> }
  | { kind: "NamedType"; name: string }

export type NumericSuffix = "mm" | "cm" | "m" | "in" | "ft" | "yd" | "deg" | "rad" | "_"

export type ArrayLength =
  | { kind: "Exact"; value: number } // [T; 5]
  | { kind: "Minimum"; value: number } // [T; 5+]

// Import statement types
export type ImportItem = {
  name: Ident // original name in the exported module
  alias?: Ident // optional rename (import x as y)
}

export type Stmt =
  | { kind: "Let"; name: Ident; expr: Expr; trivia?: Trivia }
  | { kind: "Assign"; name: Ident; expr: Expr; trivia?: Trivia } // Top-level assignment (no let)
  | { kind: "FnDef"; name: Ident; params: Param[]; body: Stmt[]; returnExpr?: Expr; returnType?: TypeAnnotation; trivia?: Trivia }
  | { kind: "Return"; expr?: Expr; trivia?: Trivia }
  | { kind: "ExprStmt"; expr: Expr; trivia?: Trivia }
  | { kind: "Annotation"; name: Ident; args: Record<string, Expr>; trivia?: Trivia } // @name(key=value, ...)
  | { kind: "Import"; path: string; items?: ImportItem[]; alias?: Ident; trivia?: Trivia } // import x from "path" or import "path" as x
  | { kind: "Export"; stmt: Stmt; trivia?: Trivia } // export fn/let/assign
  | { kind: "ExportImport"; item: ImportItem; path: string; trivia?: Trivia } // export import x from "path"

export type Program = { kind: "Program"; body: Stmt[]; leadingTrivia?: TriviaItem[] }
