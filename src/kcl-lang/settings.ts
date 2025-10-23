/**
 * KCL Settings
 *
 * Handles @settings attribute processing and default configuration.
 */

import type { NumericSuffix } from "./ast"

export interface FileSettings {
  defaultLengthUnit: NumericSuffix
  defaultAngleUnit: NumericSuffix
  kclVersion?: string
  noStd: boolean
}

export const DEFAULT_SETTINGS: FileSettings = {
  defaultLengthUnit: "mm",
  defaultAngleUnit: "deg",
  noStd: false,
}

/**
 * Extract settings from @settings annotation
 */
export function extractSettings(args: Record<string, any>): Partial<FileSettings> {
  const settings: Partial<FileSettings> = {}

  if (args.defaultLengthUnit) {
    const unit = getIdentValue(args.defaultLengthUnit)
    if (isLengthUnit(unit)) {
      settings.defaultLengthUnit = unit
    } else {
      throw new Error(`Invalid defaultLengthUnit: ${unit}. Must be one of: mm, cm, m, in, ft, yd`)
    }
  }

  if (args.defaultAngleUnit) {
    const unit = getIdentValue(args.defaultAngleUnit)
    if (isAngleUnit(unit)) {
      settings.defaultAngleUnit = unit
    } else {
      throw new Error(`Invalid defaultAngleUnit: ${unit}. Must be one of: deg, rad`)
    }
  }

  if (args.kclVersion) {
    if (args.kclVersion.kind === "String") {
      settings.kclVersion = args.kclVersion.value
    }
  }

  return settings
}

/**
 * Get the value of an identifier expression
 */
function getIdentValue(expr: any): string {
  if (expr.kind === "Var") {
    return expr.name
  }
  throw new Error(`Expected identifier, got ${expr.kind}`)
}

/**
 * Check if a string is a valid length unit
 */
function isLengthUnit(unit: string): unit is NumericSuffix {
  return ["mm", "cm", "m", "in", "ft", "yd"].includes(unit)
}

/**
 * Check if a string is a valid angle unit
 */
function isAngleUnit(unit: string): unit is NumericSuffix {
  return ["deg", "rad"].includes(unit)
}
