/**
 * KCL Unit System
 *
 * Handles unit compatibility checking and conversion for numeric literals.
 */

import type { NumericSuffix } from "./ast"

export type UnitCategory = "Length" | "Angle" | "Count"

/**
 * Get the category of a unit
 */
export function getUnitCategory(unit: NumericSuffix): UnitCategory {
  switch (unit) {
    case "mm":
    case "cm":
    case "m":
    case "in":
    case "ft":
    case "yd":
      return "Length"

    case "deg":
    case "rad":
      return "Angle"

    case "_":
      return "Count"
  }
}

/**
 * Check if two units are compatible (same category)
 */
export function areUnitsCompatible(unit1: NumericSuffix | undefined, unit2: NumericSuffix | undefined): boolean {
  // If either is undefined, consider them compatible (no unit enforcement)
  if (!unit1 || !unit2) return true

  // Same unit is always compatible
  if (unit1 === unit2) return true

  // Check if they're in the same category
  return getUnitCategory(unit1) === getUnitCategory(unit2)
}

/**
 * Convert a value from one unit to another
 * Returns the converted value, or throws if units are incompatible
 */
export function convertUnit(value: number, fromUnit: NumericSuffix, toUnit: NumericSuffix): number {
  if (fromUnit === toUnit) return value

  const fromCategory = getUnitCategory(fromUnit)
  const toCategory = getUnitCategory(toUnit)

  if (fromCategory !== toCategory) {
    throw new Error(`Cannot convert ${fromUnit} to ${toUnit}: incompatible unit categories (${fromCategory} vs ${toCategory})`)
  }

  // Length conversions (all to mm, then to target)
  if (fromCategory === "Length") {
    const toMm = (val: number, unit: NumericSuffix): number => {
      switch (unit) {
        case "mm": return val
        case "cm": return val * 10
        case "m": return val * 1000
        case "in": return val * 25.4
        case "ft": return val * 304.8
        case "yd": return val * 914.4
        default: return val
      }
    }

    const fromMm = (val: number, unit: NumericSuffix): number => {
      switch (unit) {
        case "mm": return val
        case "cm": return val / 10
        case "m": return val / 1000
        case "in": return val / 25.4
        case "ft": return val / 304.8
        case "yd": return val / 914.4
        default: return val
      }
    }

    const valueInMm = toMm(value, fromUnit)
    return fromMm(valueInMm, toUnit)
  }

  // Angle conversions
  if (fromCategory === "Angle") {
    if (fromUnit === "deg" && toUnit === "rad") {
      return (value * Math.PI) / 180
    }
    if (fromUnit === "rad" && toUnit === "deg") {
      return (value * 180) / Math.PI
    }
  }

  // Count (unitless) - no conversion needed
  return value
}

/**
 * Get a readable unit name for error messages
 */
export function getUnitName(unit: NumericSuffix): string {
  switch (unit) {
    case "mm": return "millimeters"
    case "cm": return "centimeters"
    case "m": return "meters"
    case "in": return "inches"
    case "ft": return "feet"
    case "yd": return "yards"
    case "deg": return "degrees"
    case "rad": return "radians"
    case "_": return "unitless"
  }
}

/**
 * Type guard for checking if a unit is a length unit
 */
export function isLengthUnit(unit: NumericSuffix | undefined): boolean {
  if (!unit) return false
  return getUnitCategory(unit) === "Length"
}

/**
 * Type guard for checking if a unit is an angle unit
 */
export function isAngleUnit(unit: NumericSuffix | undefined): boolean {
  if (!unit) return false
  return getUnitCategory(unit) === "Angle"
}

/**
 * Type guard for checking if a unit is unitless
 */
export function isUnitless(unit: NumericSuffix | undefined): boolean {
  if (!unit) return true
  return unit === "_"
}
