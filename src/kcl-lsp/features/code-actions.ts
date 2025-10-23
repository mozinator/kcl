/**
 * Code Actions Feature
 *
 * Provides quick fixes and refactorings.
 */

import type { Range, TextEdit, Diagnostic } from "../protocol"
import type { ParseResult } from "../document-manager"

export enum CodeActionKind {
  Empty = "",
  QuickFix = "quickfix",
  Refactor = "refactor",
  RefactorExtract = "refactor.extract",
  RefactorInline = "refactor.inline",
  RefactorRewrite = "refactor.rewrite",
  Source = "source",
  SourceOrganizeImports = "source.organizeImports",
}

export type CodeAction = {
  title: string
  kind?: CodeActionKind
  diagnostics?: Diagnostic[]
  edit?: {
    changes: Record<string, TextEdit[]>
  }
  command?: {
    title: string
    command: string
    arguments?: any[]
  }
}

/**
 * Get code actions for a range
 */
export function getCodeActions(
  parseResult: ParseResult,
  range: Range,
  diagnostics: Diagnostic[],
  uri: string
): CodeAction[] {
  const actions: CodeAction[] = []

  // Quick fix for deprecated 'let' keyword
  for (const diagnostic of diagnostics) {
    if (diagnostic.code === "deprecated-let-keyword" && diagnostic.source === "kcl-deprecated") {
      actions.push({
        title: "Remove deprecated 'let' keyword",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: diagnostic.range.start,
                  end: {
                    line: diagnostic.range.end.line,
                    character: diagnostic.range.end.character + 1, // Include the space after 'let'
                  },
                },
                newText: "",
              },
            ],
          },
        },
      })
    }
  }

  // Quick fix for parse errors
  for (const diagnostic of diagnostics) {
    if (diagnostic.source === "kcl-parser") {
      // Offer to add missing closing brace
      if (diagnostic.message.includes("Expected") && diagnostic.message.includes("}")) {
        actions.push({
          title: "Add missing closing brace",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit: {
            changes: {
              [uri]: [
                {
                  range: { start: range.end, end: range.end },
                  newText: "}",
                },
              ],
            },
          },
        })
      }

      // Offer to add missing closing paren
      if (diagnostic.message.includes("Expected") && diagnostic.message.includes(")")) {
        actions.push({
          title: "Add missing closing parenthesis",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit: {
            changes: {
              [uri]: [
                {
                  range: { start: range.end, end: range.end },
                  newText: ")",
                },
              ],
            },
          },
        })
      }
    }

    // Quick fix for type errors
    if (diagnostic.source === "kcl-typecheck") {
      if (diagnostic.message.includes("Unknown function")) {
        // Extract function name from error message
        const match = diagnostic.message.match(/Unknown function: (\w+)/)
        if (match) {
          const funcName = match[1]
          actions.push({
            title: `Define function '${funcName}'`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            edit: {
              changes: {
                [uri]: [
                  {
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    newText: `fn ${funcName}() {\n  // TODO: implement\n}\n\n`,
                  },
                ],
              },
            },
          })
        }
      }
    }
  }

  // Source actions
  if (parseResult.success) {
    // Organize imports (placeholder - would need import analysis)
    actions.push({
      title: "Organize imports",
      kind: CodeActionKind.SourceOrganizeImports,
    })

    // Add missing let keyword
    actions.push({
      title: "Add 'let' keyword to assignments",
      kind: CodeActionKind.QuickFix,
    })
  }

  return actions
}
