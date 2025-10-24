/**
 * Unit System Tests
 *
 * Tests for unit compatibility checking, conversion, and categorization.
 */

import { describe, test, expect } from "bun:test"
import {
  getUnitCategory,
  areUnitsCompatible,
  convertUnit,
  getUnitName,
  isLengthUnit,
  isAngleUnit,
  isUnitless,
  type UnitCategory
} from "../../src/kcl-lang/units"
import type { NumericSuffix } from "../../src/kcl-lang/ast"

describe("Unit Category Classification", () => {
  test("length units", () => {
    const lengthUnits: NumericSuffix[] = ["mm", "cm", "m", "in", "ft", "yd"]
    for (const unit of lengthUnits) {
      expect(getUnitCategory(unit)).toBe("Length")
    }
  })

  test("angle units", () => {
    expect(getUnitCategory("deg")).toBe("Angle")
    expect(getUnitCategory("rad")).toBe("Angle")
  })

  test("count unit", () => {
    expect(getUnitCategory("_")).toBe("Count")
  })
})

describe("Unit Compatibility", () => {
  test("same unit is compatible", () => {
    expect(areUnitsCompatible("mm", "mm")).toBe(true)
    expect(areUnitsCompatible("deg", "deg")).toBe(true)
    expect(areUnitsCompatible("_", "_")).toBe(true)
  })

  test("length units are compatible with each other", () => {
    expect(areUnitsCompatible("mm", "cm")).toBe(true)
    expect(areUnitsCompatible("m", "in")).toBe(true)
    expect(areUnitsCompatible("ft", "yd")).toBe(true)
  })

  test("angle units are compatible with each other", () => {
    expect(areUnitsCompatible("deg", "rad")).toBe(true)
    expect(areUnitsCompatible("rad", "deg")).toBe(true)
  })

  test("length and angle units are not compatible", () => {
    expect(areUnitsCompatible("mm", "deg")).toBe(false)
    expect(areUnitsCompatible("m", "rad")).toBe(false)
  })

  test("length and count units are not compatible", () => {
    expect(areUnitsCompatible("mm", "_")).toBe(false)
    expect(areUnitsCompatible("m", "_")).toBe(false)
  })

  test("angle and count units are not compatible", () => {
    expect(areUnitsCompatible("deg", "_")).toBe(false)
    expect(areUnitsCompatible("rad", "_")).toBe(false)
  })

  test("undefined units are always compatible", () => {
    expect(areUnitsCompatible(undefined, "mm")).toBe(true)
    expect(areUnitsCompatible("mm", undefined)).toBe(true)
    expect(areUnitsCompatible(undefined, undefined)).toBe(true)
  })
})

describe("Length Unit Conversions", () => {
  test("same unit returns same value", () => {
    expect(convertUnit(10, "mm", "mm")).toBe(10)
    expect(convertUnit(5.5, "m", "m")).toBe(5.5)
  })

  test("metric length conversions", () => {
    // mm to cm
    expect(convertUnit(100, "mm", "cm")).toBe(10)
    // cm to mm
    expect(convertUnit(10, "cm", "mm")).toBe(100)
    // mm to m
    expect(convertUnit(1000, "mm", "m")).toBe(1)
    // m to mm
    expect(convertUnit(1, "m", "mm")).toBe(1000)
    // cm to m
    expect(convertUnit(100, "cm", "m")).toBe(1)
  })

  test("imperial length conversions", () => {
    // in to ft
    expect(convertUnit(12, "in", "ft")).toBeCloseTo(1, 5)
    // ft to in
    expect(convertUnit(1, "ft", "in")).toBeCloseTo(12, 5)
    // ft to yd
    expect(convertUnit(3, "ft", "yd")).toBeCloseTo(1, 5)
    // yd to ft
    expect(convertUnit(1, "yd", "ft")).toBeCloseTo(3, 5)
  })

  test("metric to imperial conversions", () => {
    // mm to in
    expect(convertUnit(25.4, "mm", "in")).toBeCloseTo(1, 5)
    // in to mm
    expect(convertUnit(1, "in", "mm")).toBeCloseTo(25.4, 5)
    // m to ft
    expect(convertUnit(304.8, "mm", "ft")).toBeCloseTo(1, 5)
  })

  test("complex conversion chains", () => {
    // yd to cm (yd -> mm -> cm)
    const yards = 1
    const mm = convertUnit(yards, "yd", "mm")
    expect(mm).toBeCloseTo(914.4, 5)
    const cm = convertUnit(mm, "mm", "cm")
    expect(cm).toBeCloseTo(91.44, 5)
  })
})

describe("Angle Unit Conversions", () => {
  test("degrees to radians", () => {
    expect(convertUnit(0, "deg", "rad")).toBeCloseTo(0, 5)
    expect(convertUnit(180, "deg", "rad")).toBeCloseTo(Math.PI, 5)
    expect(convertUnit(90, "deg", "rad")).toBeCloseTo(Math.PI / 2, 5)
    expect(convertUnit(360, "deg", "rad")).toBeCloseTo(2 * Math.PI, 5)
  })

  test("radians to degrees", () => {
    expect(convertUnit(0, "rad", "deg")).toBeCloseTo(0, 5)
    expect(convertUnit(Math.PI, "rad", "deg")).toBeCloseTo(180, 5)
    expect(convertUnit(Math.PI / 2, "rad", "deg")).toBeCloseTo(90, 5)
    expect(convertUnit(2 * Math.PI, "rad", "deg")).toBeCloseTo(360, 5)
  })
})

describe("Count Unit Conversions", () => {
  test("count units don't convert", () => {
    expect(convertUnit(42, "_", "_")).toBe(42)
  })
})

describe("Invalid Unit Conversions", () => {
  test("length to angle throws error", () => {
    expect(() => convertUnit(10, "mm", "deg")).toThrow(/incompatible unit categories/)
  })

  test("angle to length throws error", () => {
    expect(() => convertUnit(90, "deg", "mm")).toThrow(/incompatible unit categories/)
  })

  test("length to count throws error", () => {
    expect(() => convertUnit(10, "mm", "_")).toThrow(/incompatible unit categories/)
  })

  test("error message includes unit names and categories", () => {
    expect(() => convertUnit(10, "mm", "deg")).toThrow(/mm.*deg/)
    expect(() => convertUnit(10, "mm", "deg")).toThrow(/Length.*Angle/)
  })
})

describe("Unit Name Display", () => {
  test("length unit names", () => {
    expect(getUnitName("mm")).toBe("millimeters")
    expect(getUnitName("cm")).toBe("centimeters")
    expect(getUnitName("m")).toBe("meters")
    expect(getUnitName("in")).toBe("inches")
    expect(getUnitName("ft")).toBe("feet")
    expect(getUnitName("yd")).toBe("yards")
  })

  test("angle unit names", () => {
    expect(getUnitName("deg")).toBe("degrees")
    expect(getUnitName("rad")).toBe("radians")
  })

  test("count unit name", () => {
    expect(getUnitName("_")).toBe("unitless")
  })
})

describe("Unit Type Guards", () => {
  describe("isLengthUnit", () => {
    test("returns true for length units", () => {
      const lengthUnits: NumericSuffix[] = ["mm", "cm", "m", "in", "ft", "yd"]
      for (const unit of lengthUnits) {
        expect(isLengthUnit(unit)).toBe(true)
      }
    })

    test("returns false for non-length units", () => {
      expect(isLengthUnit("deg")).toBe(false)
      expect(isLengthUnit("rad")).toBe(false)
      expect(isLengthUnit("_")).toBe(false)
    })

    test("returns false for undefined", () => {
      expect(isLengthUnit(undefined)).toBe(false)
    })
  })

  describe("isAngleUnit", () => {
    test("returns true for angle units", () => {
      expect(isAngleUnit("deg")).toBe(true)
      expect(isAngleUnit("rad")).toBe(true)
    })

    test("returns false for non-angle units", () => {
      expect(isAngleUnit("mm")).toBe(false)
      expect(isAngleUnit("m")).toBe(false)
      expect(isAngleUnit("_")).toBe(false)
    })

    test("returns false for undefined", () => {
      expect(isAngleUnit(undefined)).toBe(false)
    })
  })

  describe("isUnitless", () => {
    test("returns true for count unit", () => {
      expect(isUnitless("_")).toBe(true)
    })

    test("returns true for undefined", () => {
      expect(isUnitless(undefined)).toBe(true)
    })

    test("returns false for all other units", () => {
      expect(isUnitless("mm")).toBe(false)
      expect(isUnitless("deg")).toBe(false)
    })
  })
})

describe("Edge Cases & Precision", () => {
  test("very small values", () => {
    const small = 0.001
    expect(convertUnit(small, "mm", "m")).toBeCloseTo(0.000001, 10)
  })

  test("very large values", () => {
    const large = 1000000
    expect(convertUnit(large, "mm", "m")).toBe(1000)
  })

  test("negative values", () => {
    expect(convertUnit(-10, "mm", "cm")).toBe(-1)
    expect(convertUnit(-180, "deg", "rad")).toBeCloseTo(-Math.PI, 5)
  })

  test("zero", () => {
    expect(convertUnit(0, "mm", "m")).toBe(0)
    expect(convertUnit(0, "deg", "rad")).toBe(0)
  })

  test("fractional values maintain precision", () => {
    expect(convertUnit(2.54, "in", "mm")).toBeCloseTo(64.516, 5)
    expect(convertUnit(45.5, "deg", "rad")).toBeCloseTo(0.7941248, 5)
  })
})
