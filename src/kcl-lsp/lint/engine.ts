/**
 * Lint Engine
 *
 * Coordinates running multiple lint rules on KCL code and collecting diagnostics.
 */

import type { Diagnostic } from "../protocol"
import type { ParseResult } from "../document-manager"
import type { Program, Stmt } from "../../kcl-lang/ast"

export type LintSeverity = "error" | "warning" | "info" | "hint"

export type LintContext = {
  program: Program
  tokens: any[]
  lineOffsets: number[]
  sourceText?: string
}

export interface LintRule {
  name: string
  description: string
  severity: LintSeverity
  check(context: LintContext): Diagnostic[]
}

export type LintConfig = {
  enabled: boolean
  disabledRules?: string[]
  severity?: Record<string, LintSeverity>
}

export class LintEngine {
  private rules: LintRule[]
  private config: LintConfig

  constructor(rules: LintRule[], config: LintConfig = { enabled: true }) {
    this.rules = rules
    this.config = config
  }

  /**
   * Run all enabled lint rules on the parsed code
   */
  lint(parseResult: ParseResult): Diagnostic[] {
    if (!this.config.enabled) {
      return []
    }

    if (!parseResult.success) {
      return []
    }

    const context: LintContext = {
      program: parseResult.program,
      tokens: parseResult.tokens,
      lineOffsets: parseResult.lineOffsets,
    }

    const diagnostics: Diagnostic[] = []

    for (const rule of this.rules) {
      // Skip disabled rules
      if (this.config.disabledRules?.includes(rule.name)) {
        continue
      }

      try {
        const ruleDiagnostics = rule.check(context)

        // Apply severity overrides
        const severity = this.config.severity?.[rule.name]
        if (severity) {
          for (const diag of ruleDiagnostics) {
            diag.severity = this.severityToNumber(severity)
          }
        }

        diagnostics.push(...ruleDiagnostics)
      } catch (error) {
        // Don't let a broken rule crash the entire linter
        console.error(`Lint rule ${rule.name} failed:`, error)
      }
    }

    return diagnostics
  }

  /**
   * Get all registered rules
   */
  getRules(): LintRule[] {
    return this.rules
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LintConfig>) {
    this.config = { ...this.config, ...config }
  }

  private severityToNumber(severity: LintSeverity): number {
    switch (severity) {
      case "error": return 1
      case "warning": return 2
      case "info": return 3
      case "hint": return 4
    }
  }
}

/**
 * Create the default set of lint rules
 */
export function createDefaultRules(): LintRule[] {
  const rules: LintRule[] = []

  // Import rules - using dynamic import to handle module resolution
  try {
    const camelCase = require("./rules/camel-case")
    if (camelCase?.camelCaseRule) rules.push(camelCase.camelCaseRule)
  } catch (e) {
    console.error("Failed to load camelCase rule:", e)
  }

  try {
    const unusedVar = require("./rules/unused-variable")
    if (unusedVar?.unusedVariableRule) rules.push(unusedVar.unusedVariableRule)
  } catch (e) {
    console.error("Failed to load unusedVariable rule:", e)
  }

  try {
    const noMagic = require("./rules/no-magic-numbers")
    if (noMagic?.noMagicNumbersRule) rules.push(noMagic.noMagicNumbersRule)
  } catch (e) {
    console.error("Failed to load noMagicNumbers rule:", e)
  }

  try {
    const defaultPlane = require("./rules/default-plane")
    if (defaultPlane?.defaultPlaneRule) rules.push(defaultPlane.defaultPlaneRule)
  } catch (e) {
    console.error("Failed to load defaultPlane rule:", e)
  }

  return rules
}
