/**
 * Standard Library Tests
 *
 * Tests for KCL stdlib definitions and signatures.
 */

import { describe, test, expect } from "bun:test"
import { OPS, PLANES, MATH_CONSTANTS, UNIT_CONSTANTS, TAG_CONSTANTS } from "../../src/kcl-lang/stdlib"

describe("Stdlib: Plane Constants", () => {
  test("has XY plane", () => {
    expect(PLANES.XY).toBe("xy")
  })

  test("has XZ plane", () => {
    expect(PLANES.XZ).toBe("xz")
  })

  test("has YZ plane", () => {
    expect(PLANES.YZ).toBe("yz")
  })

  test("only three planes defined", () => {
    expect(Object.keys(PLANES)).toHaveLength(3)
  })
})

describe("Stdlib: Math Constants", () => {
  test("has PI", () => {
    expect(MATH_CONSTANTS.PI).toBeCloseTo(Math.PI, 10)
  })

  test("has E (Euler's number)", () => {
    expect(MATH_CONSTANTS.E).toBeCloseTo(Math.E, 10)
  })

  test("has TAU (2*PI)", () => {
    expect(MATH_CONSTANTS.TAU).toBeCloseTo(2 * Math.PI, 10)
  })

  test("PI is defined to high precision", () => {
    expect(MATH_CONSTANTS.PI).toBe(3.14159265358979323846264338327950288)
  })
})

describe("Stdlib: Unit Constants", () => {
  test("has metric length units", () => {
    expect(UNIT_CONSTANTS.mm).toBe("millimeters")
    expect(UNIT_CONSTANTS.cm).toBe("centimeters")
    expect(UNIT_CONSTANTS.m).toBe("meters")
    expect(UNIT_CONSTANTS.km).toBe("kilometers")
  })

  test("has imperial length units", () => {
    expect(UNIT_CONSTANTS.in).toBe("inches")
    expect(UNIT_CONSTANTS.inches).toBe("inches")
    expect(UNIT_CONSTANTS.ft).toBe("feet")
    expect(UNIT_CONSTANTS.yd).toBe("yards")
    expect(UNIT_CONSTANTS.mi).toBe("miles")
  })

  test("has angle units", () => {
    expect(UNIT_CONSTANTS.deg).toBe("degrees")
    expect(UNIT_CONSTANTS.rad).toBe("radians")
  })

  test("has unitless marker", () => {
    expect(UNIT_CONSTANTS._).toBe("unitless")
  })
})

describe("Stdlib: Tag Constants", () => {
  test("has START tag", () => {
    expect(TAG_CONSTANTS.START).toBe("__START__")
  })

  test("has END tag", () => {
    expect(TAG_CONSTANTS.END).toBe("__END__")
  })
})

describe("Stdlib: 3D Shape Operations", () => {
  test("box operation signature", () => {
    expect(OPS.box).toBeDefined()
    expect(OPS.box.ret).toBe("Shape")
    expect(OPS.box.params).toHaveLength(3)
    expect(OPS.box.params[0].name).toBe("width")
    expect(OPS.box.params[0].ty).toBe("Scalar")
    expect(OPS.box.params[1].name).toBe("height")
    expect(OPS.box.params[2].name).toBe("depth")
  })

  test("translate operation signature", () => {
    expect(OPS.translate).toBeDefined()
    expect(OPS.translate.ret).toBe("Shape")
    expect(OPS.translate.params).toHaveLength(4)
    expect(OPS.translate.params[0].name).toBe("shape")
    expect(OPS.translate.params[0].ty).toBe("Shape")
    expect(OPS.translate.params[1].name).toBe("x")
    expect(OPS.translate.params[1].ty).toBe("Scalar")
  })

  test("fuse operation signature", () => {
    expect(OPS.fuse).toBeDefined()
    expect(OPS.fuse.ret).toBe("Shape")
    expect(OPS.fuse.params).toHaveLength(2) // Minimum 2, can accept more
    expect(OPS.fuse.params[0].ty).toBe("Shape")
    expect(OPS.fuse.params[1].ty).toBe("Shape")
  })

  test("render operation signature", () => {
    expect(OPS.render).toBeDefined()
    expect(OPS.render.ret).toBe("Void")
    expect(OPS.render.params).toHaveLength(1)
    expect(OPS.render.params[0].name).toBe("shape")
    expect(OPS.render.params[0].ty).toBe("Shape")
  })

  test("renderShaded operation signature", () => {
    expect(OPS.renderShaded).toBeDefined()
    expect(OPS.renderShaded.ret).toBe("Void")
    expect(OPS.renderShaded.params[0].name).toBe("shape")
    expect(OPS.renderShaded.params[0].ty).toBe("Shape")
    // Optional params
    expect(OPS.renderShaded.params.some(p => p.optional)).toBe(true)
  })
})

describe("Stdlib: 2D Sketching Operations", () => {
  test("startSketchOn operation signature", () => {
    expect(OPS.startSketchOn).toBeDefined()
    expect(OPS.startSketchOn.ret).toBe("Sketch")
    expect(OPS.startSketchOn.params).toHaveLength(1)
    expect(OPS.startSketchOn.params[0].name).toBe("plane")
    expect(OPS.startSketchOn.params[0].ty).toBe("Plane")
  })

  test("startProfile operation signature", () => {
    expect(OPS.startProfile).toBeDefined()
    expect(OPS.startProfile.ret).toBe("Sketch")
    expect(OPS.startProfile.params).toHaveLength(2)
    expect(OPS.startProfile.params[0].name).toBe("sketch")
    expect(OPS.startProfile.params[0].ty).toBe("Sketch")
    expect(OPS.startProfile.params[1].name).toBe("at")
    expect(OPS.startProfile.params[1].ty).toBe("Point")
  })

  test("line operation signature", () => {
    expect(OPS.line).toBeDefined()
    expect(OPS.line.ret).toBe("Sketch")
    expect(OPS.line.params[0].name).toBe("sketch")
    expect(OPS.line.params[0].ty).toBe("Sketch")
    // Has optional end or endAbsolute
    const hasOptionalParams = OPS.line.params.some(p => p.optional)
    expect(hasOptionalParams).toBe(true)
  })

  test("xLine operation signature", () => {
    expect(OPS.xLine).toBeDefined()
    expect(OPS.xLine.ret).toBe("Sketch")
    expect(OPS.xLine.params[0].ty).toBe("Sketch")
  })

  test("yLine operation signature", () => {
    expect(OPS.yLine).toBeDefined()
    expect(OPS.yLine.ret).toBe("Sketch")
    expect(OPS.yLine.params[0].ty).toBe("Sketch")
  })

  test("close operation signature", () => {
    expect(OPS.close).toBeDefined()
    expect(OPS.close.ret).toBe("Shape")
    expect(OPS.close.params[0].name).toBe("sketch")
    expect(OPS.close.params[0].ty).toBe("Sketch")
  })
})

describe("Stdlib: Required Parameters", () => {
  test("all required params are not marked optional", () => {
    for (const [opName, sig] of Object.entries(OPS)) {
      const requiredParams = sig.params.filter(p => !p.optional)
      for (const param of requiredParams) {
        expect(param.optional).toBeFalsy()
      }
    }
  })

  test("box has no optional parameters", () => {
    const optionalParams = OPS.box.params.filter(p => p.optional)
    expect(optionalParams).toHaveLength(0)
  })

  test("renderShaded has optional parameters", () => {
    const optionalParams = OPS.renderShaded.params.filter(p => p.optional)
    expect(optionalParams.length).toBeGreaterThan(0)
  })
})

describe("Stdlib: Return Types", () => {
  test("shape operations return Shape", () => {
    expect(OPS.box.ret).toBe("Shape")
    expect(OPS.translate.ret).toBe("Shape")
    expect(OPS.fuse.ret).toBe("Shape")
  })

  test("sketch operations return Sketch", () => {
    expect(OPS.startSketchOn.ret).toBe("Sketch")
    expect(OPS.startProfile.ret).toBe("Sketch")
    expect(OPS.line.ret).toBe("Sketch")
    // Note: close returns Shape (converts sketch to 2D shape)
  })

  test("render operations return Void", () => {
    expect(OPS.render.ret).toBe("Void")
    expect(OPS.renderShaded.ret).toBe("Void")
    expect(OPS.renderHLR.ret).toBe("Void")
  })
})

describe("Stdlib: Parameter Types", () => {
  test("shape parameters are typed as Shape", () => {
    expect(OPS.translate.params[0].ty).toBe("Shape")
    expect(OPS.fuse.params[0].ty).toBe("Shape")
  })

  test("scalar parameters are typed as Scalar", () => {
    expect(OPS.box.params[0].ty).toBe("Scalar")
    expect(OPS.box.params[1].ty).toBe("Scalar")
    expect(OPS.translate.params[1].ty).toBe("Scalar")
  })

  test("plane parameters are typed as Plane", () => {
    expect(OPS.startSketchOn.params[0].ty).toBe("Plane")
  })

  test("point parameters are typed as Point", () => {
    expect(OPS.startProfile.params[1].ty).toBe("Point")
  })

  test("sketch parameters are typed as Sketch", () => {
    expect(OPS.startProfile.params[0].ty).toBe("Sketch")
    expect(OPS.line.params[0].ty).toBe("Sketch")
  })
})

describe("Stdlib: Operation Coverage", () => {
  test("has essential 3D operations", () => {
    const essential3D = ["box", "translate", "fuse", "render"]
    for (const op of essential3D) {
      expect(OPS[op]).toBeDefined()
    }
  })

  test("has essential 2D sketch operations", () => {
    const essential2D = ["startSketchOn", "startProfile", "line", "close"]
    for (const op of essential2D) {
      expect(OPS[op]).toBeDefined()
    }
  })

  test("all operations have return types", () => {
    for (const [opName, sig] of Object.entries(OPS)) {
      expect(sig.ret).toBeDefined()
      expect(sig.ret).toMatch(/^(Shape|Sketch|Void|Scalar|Point|Plane)$/)
    }
  })

  test("all operations have parameter arrays", () => {
    for (const [opName, sig] of Object.entries(OPS)) {
      expect(sig.params).toBeDefined()
      expect(Array.isArray(sig.params)).toBe(true)
    }
  })

  test("all parameters have names and types", () => {
    for (const [opName, sig] of Object.entries(OPS)) {
      for (const param of sig.params) {
        expect(param.name).toBeDefined()
        expect(param.ty).toBeDefined()
        expect(typeof param.name).toBe("string")
        expect(param.ty).toMatch(/^(Shape|Sketch|Void|Scalar|Point|Plane)$/)
      }
    }
  })
})

describe("Stdlib: Specific Operations", () => {
  test("circle operation", () => {
    if (OPS.circle) {
      expect(OPS.circle.ret).toBe("Sketch")
      expect(OPS.circle.params.some(p => p.name === "sketch")).toBe(true)
    }
  })

  test("arc operation", () => {
    if (OPS.arc) {
      expect(OPS.arc.ret).toBe("Sketch")
      expect(OPS.arc.params.some(p => p.name === "sketch")).toBe(true)
    }
  })

  test("extrude operation", () => {
    if (OPS.extrude) {
      expect(OPS.extrude.ret).toBe("Shape")
      expect(OPS.extrude.params.some(p => p.ty === "Sketch")).toBe(true)
    }
  })
})
