/**
 * KCL Standard Library
 *
 * Operation signatures and type definitions for KCL.
 * Includes 3D operations (box, translate, fuse) and 2D sketching (startSketchOn, line, etc.)
 */

type Ty = "Shape" | "Scalar" | "Void" | "Sketch" | "Point" | "Plane"

type Param = {
  name: string
  ty: Ty
  optional?: boolean
}

export type OpSig = {
  ret: Ty
  params: Param[]
}

/**
 * Plane constants
 */
export const PLANES: Record<string, string> = {
  XY: "xy",
  XZ: "xz",
  YZ: "yz",
}

/**
 * Math constants
 */
export const MATH_CONSTANTS: Record<string, number> = {
  PI: 3.14159265358979323846264338327950288,
  E: 2.71828182845904523536028747135266250,
  TAU: 6.28318530717958647692528676655900577,
}

/**
 * Unit constants
 * These are symbolic identifiers for units used in @settings annotations and conversions
 */
export const UNIT_CONSTANTS: Record<string, string> = {
  // Metric length units
  mm: "millimeters",
  cm: "centimeters",
  m: "meters",
  km: "kilometers",

  // Imperial length units
  inches: "inches",
  in: "inches",
  ft: "feet",
  yd: "yards",
  mi: "miles",

  // Angle units
  deg: "degrees",
  rad: "radians",

  // Unitless
  _: "unitless",
}

/**
 * Tag constants
 * Special constants for identifying faces in extrusions
 */
export const TAG_CONSTANTS: Record<string, string> = {
  START: "__START__",
  END: "__END__",
}

/**
 * Core operation registry
 * Maps operation names to their type signatures
 */
export const OPS: Record<string, OpSig> = {
  // === 3D Shape Operations ===
  box: {
    ret: "Shape",
    params: [
      { name: "width", ty: "Scalar" },
      { name: "height", ty: "Scalar" },
      { name: "depth", ty: "Scalar" },
    ],
  },
  translate: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "x", ty: "Scalar" },
      { name: "y", ty: "Scalar" },
      { name: "z", ty: "Scalar" },
    ],
  },
  fuse: {
    ret: "Shape",
    params: [
      { name: "a", ty: "Shape" },
      { name: "b", ty: "Shape" },
      // N-ary fuse handled in parser/typecheck
    ],
  },
  render: {
    ret: "Void",
    params: [{ name: "shape", ty: "Shape" }],
  },
  renderHLR: {
    ret: "Void",
    params: [
      { name: "shape", ty: "Sketch" }, // Changed to Sketch to support wire rendering
      { name: "camera", ty: "Scalar", optional: true },
      { name: "path", ty: "Scalar", optional: true },
      { name: "showDirectionArrows", ty: "Scalar", optional: true },
      { name: "arrowSize", ty: "Scalar", optional: true },
      { name: "arrowSpacing", ty: "Scalar", optional: true },
    ],
  },
  renderShaded: {
    ret: "Void",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "camera", ty: "Scalar", optional: true },
      { name: "path", ty: "Scalar", optional: true },
    ],
  },

  // === 2D Sketching Operations ===
  startSketchOn: {
    ret: "Sketch",
    params: [{ name: "plane", ty: "Plane" }],
  },
  startProfile: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "at", ty: "Point" },
    ],
  },
  line: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "end", ty: "Point", optional: true },
      { name: "endAbsolute", ty: "Point", optional: true },
    ],
  },
  xLine: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "length", ty: "Scalar", optional: true },
      { name: "endAbsolute", ty: "Scalar", optional: true },
    ],
  },
  yLine: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "length", ty: "Scalar", optional: true },
      { name: "endAbsolute", ty: "Scalar", optional: true },
    ],
  },
  tangentialArc: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "end", ty: "Point", optional: true },
      { name: "endAbsolute", ty: "Point", optional: true },
      { name: "angle", ty: "Scalar", optional: true },
      { name: "radius", ty: "Scalar", optional: true },
    ],
  },
  circle: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "center", ty: "Point", optional: true },
      { name: "radius", ty: "Scalar", optional: true },
    ],
  },
  profileStart: {
    ret: "Point",
    params: [{ name: "sketch", ty: "Sketch", optional: true }],
  },
  close: {
    ret: "Shape",
    params: [{ name: "sketch", ty: "Sketch" }],
  },

  // === Math Functions ===
  // Trigonometric functions
  sin: {
    ret: "Scalar",
    params: [{ name: "num", ty: "Scalar" }],
  },
  cos: {
    ret: "Scalar",
    params: [{ name: "num", ty: "Scalar" }],
  },
  tan: {
    ret: "Scalar",
    params: [{ name: "num", ty: "Scalar" }],
  },
  asin: {
    ret: "Scalar",
    params: [{ name: "num", ty: "Scalar" }],
  },
  acos: {
    ret: "Scalar",
    params: [{ name: "num", ty: "Scalar" }],
  },
  atan: {
    ret: "Scalar",
    params: [{ name: "num", ty: "Scalar" }],
  },
  atan2: {
    ret: "Scalar",
    params: [
      { name: "y", ty: "Scalar" },
      { name: "x", ty: "Scalar" },
    ],
  },

  // Basic math functions
  sqrt: {
    ret: "Scalar",
    params: [{ name: "input", ty: "Scalar" }],
  },
  abs: {
    ret: "Scalar",
    params: [{ name: "input", ty: "Scalar" }],
  },
  pow: {
    ret: "Scalar",
    params: [
      { name: "base", ty: "Scalar" },
      { name: "exponent", ty: "Scalar" },
    ],
  },

  // Rounding functions
  round: {
    ret: "Scalar",
    params: [{ name: "input", ty: "Scalar" }],
  },
  floor: {
    ret: "Scalar",
    params: [{ name: "input", ty: "Scalar" }],
  },
  ceil: {
    ret: "Scalar",
    params: [{ name: "input", ty: "Scalar" }],
  },

  // Logarithmic functions
  log: {
    ret: "Scalar",
    params: [{ name: "input", ty: "Scalar" }],
  },
  log2: {
    ret: "Scalar",
    params: [{ name: "input", ty: "Scalar" }],
  },
  log10: {
    ret: "Scalar",
    params: [{ name: "input", ty: "Scalar" }],
  },

  // Min/Max functions
  min: {
    ret: "Scalar",
    params: [
      { name: "a", ty: "Scalar" },
      { name: "b", ty: "Scalar" },
    ],
  },
  max: {
    ret: "Scalar",
    params: [
      { name: "a", ty: "Scalar" },
      { name: "b", ty: "Scalar" },
    ],
  },

  // === Vector Operations (std::vector) ===
  "vector::add": {
    ret: "Point",
    params: [
      { name: "u", ty: "Point" },
      { name: "v", ty: "Point" },
    ],
  },
  "vector::sub": {
    ret: "Point",
    params: [
      { name: "u", ty: "Point" },
      { name: "v", ty: "Point" },
    ],
  },
  "vector::mul": {
    ret: "Point",
    params: [
      { name: "v", ty: "Point" },
      { name: "s", ty: "Scalar" },
    ],
  },
  "vector::div": {
    ret: "Point",
    params: [
      { name: "v", ty: "Point" },
      { name: "s", ty: "Scalar" },
    ],
  },
  "vector::dot": {
    ret: "Scalar",
    params: [
      { name: "u", ty: "Point" },
      { name: "v", ty: "Point" },
    ],
  },
  "vector::cross": {
    ret: "Point",
    params: [
      { name: "u", ty: "Point" },
      { name: "v", ty: "Point" },
    ],
  },
  "vector::magnitude": {
    ret: "Scalar",
    params: [{ name: "v", ty: "Point" }],
  },
  "vector::normalize": {
    ret: "Point",
    params: [{ name: "v", ty: "Point" }],
  },

  // === Testing/Validation ===
  assert: {
    ret: "Void",
    params: [
      { name: "actual", ty: "Scalar" },
      { name: "isEqualTo", ty: "Scalar", optional: true },
      { name: "isGreaterThan", ty: "Scalar", optional: true },
      { name: "isLessThan", ty: "Scalar", optional: true },
      { name: "isGreaterThanOrEqual", ty: "Scalar", optional: true },
      { name: "isLessThanOrEqual", ty: "Scalar", optional: true },
      { name: "tolerance", ty: "Scalar", optional: true },
      { name: "error", ty: "Scalar", optional: true },
    ],
  },
  assertIs: {
    ret: "Void",
    params: [
      { name: "actual", ty: "Scalar" },
      { name: "error", ty: "Scalar", optional: true },
    ],
  },

  // ============================================================================
  // TODO: The following operations need implementation
  // These are placeholders from the Zoo.dev KCL Standard Library
  // ============================================================================

  // === TODO: std::sketch - Advanced 2D Sketch Operations ===

  // TODO: angledLine - Line at an angle
  angledLine: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "angle", ty: "Scalar" },
      { name: "length", ty: "Scalar" },
    ],
  },

  // TODO: arc - Circular arc
  arc: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "start", ty: "Point" },
      { name: "end", ty: "Point" },
      { name: "radius", ty: "Scalar" },
    ],
  },

  // TODO: bezierCurve - Bezier curve
  bezierCurve: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "controlPoints", ty: "Point" }, // Should be array
    ],
  },

  // TODO: ellipse - Ellipse shape
  ellipse: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "center", ty: "Point" },
      { name: "majorRadius", ty: "Scalar" },
      { name: "minorRadius", ty: "Scalar" },
    ],
  },

  // TODO: rectangle - Rectangle shape
  rectangle: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "width", ty: "Scalar" },
      { name: "height", ty: "Scalar" },
    ],
  },

  // TODO: polygon - Regular polygon
  polygon: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "sides", ty: "Scalar" },
      { name: "radius", ty: "Scalar" },
    ],
  },

  // TODO: segLen - Get length of segment
  segLen: {
    ret: "Scalar",
    params: [
      { name: "segment", ty: "Sketch" }, // Should be Tag type
    ],
  },

  // TODO: segAng - Get angle of segment
  segAng: {
    ret: "Scalar",
    params: [
      { name: "segment", ty: "Sketch" }, // Should be Tag type
    ],
  },

  // TODO: segStart - Get start point of segment
  segStart: {
    ret: "Point",
    params: [
      { name: "segment", ty: "Sketch" }, // Should be Tag type
    ],
  },

  // TODO: segEnd - Get end point of segment
  segEnd: {
    ret: "Point",
    params: [
      { name: "segment", ty: "Sketch" }, // Should be Tag type
    ],
  },

  // === TODO: std::solid - 3D Operations ===

  // TODO: extrude - Extrude 2D sketch to 3D
  extrude: {
    ret: "Shape",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "length", ty: "Scalar" },
    ],
  },

  // TODO: revolve - Revolve sketch around axis
  revolve: {
    ret: "Shape",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "axis", ty: "Point" }, // Should be axis type
      { name: "angle", ty: "Scalar", optional: true },
    ],
  },

  // TODO: loft - Loft between multiple sketches
  loft: {
    ret: "Shape",
    params: [
      { name: "sketches", ty: "Sketch" }, // Should be array
    ],
  },

  // TODO: sweep - Sweep sketch along path
  sweep: {
    ret: "Shape",
    params: [
      { name: "profile", ty: "Sketch" },
      { name: "path", ty: "Sketch" },
    ],
  },

  // TODO: union - Boolean union
  union: {
    ret: "Shape",
    params: [
      { name: "shapes", ty: "Shape" }, // Should be array or variadic
    ],
  },

  // TODO: subtract - Boolean subtraction
  subtract: {
    ret: "Shape",
    params: [
      { name: "base", ty: "Shape" },
      { name: "tool", ty: "Shape" },
    ],
  },

  // TODO: subtract2d - 2D Boolean subtraction
  subtract2d: {
    ret: "Sketch",
    params: [
      { name: "base", ty: "Sketch" },
      { name: "tool", ty: "Sketch" },
    ],
  },

  // TODO: intersect - Boolean intersection
  intersect: {
    ret: "Shape",
    params: [
      { name: "a", ty: "Shape" },
      { name: "b", ty: "Shape" },
    ],
  },

  // TODO: fillet - Round edges
  fillet: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "radius", ty: "Scalar" },
      { name: "edges", ty: "Shape", optional: true }, // Should be Tag array
    ],
  },

  // TODO: chamfer - Chamfer edges
  chamfer: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "distance", ty: "Scalar" },
      { name: "edges", ty: "Shape", optional: true }, // Should be Tag array
    ],
  },

  // TODO: shell - Hollow out solid
  shell: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "thickness", ty: "Scalar" },
      { name: "faces", ty: "Shape", optional: true }, // Should be Tag array
    ],
  },

  // TODO: hollow - Create hollow interior
  hollow: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "thickness", ty: "Scalar" },
    ],
  },

  // TODO: appearance - Set visual appearance
  appearance: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "color", ty: "Scalar" }, // Should be color type
      { name: "metallic", ty: "Scalar", optional: true },
      { name: "roughness", ty: "Scalar", optional: true },
    ],
  },

  // === std::solid - Patterning ===

  // patternLinear2d - Linear 2D pattern
  patternLinear2d: {
    ret: "Sketch",
    params: [
      { name: "entities", ty: "Sketch" },
      { name: "count", ty: "Scalar" },
      { name: "spacing", ty: "Scalar" },
      { name: "direction", ty: "Point" },
    ],
  },

  // patternLinear3d - Linear 3D pattern
  patternLinear3d: {
    ret: "Shape",
    params: [
      { name: "features", ty: "Shape" },
      { name: "count", ty: "Scalar" },
      { name: "spacing", ty: "Scalar" },
      { name: "direction", ty: "Point" },
    ],
  },

  // patternCircular2d - Circular 2D pattern
  patternCircular2d: {
    ret: "Sketch",
    params: [
      { name: "entities", ty: "Sketch" },
      { name: "count", ty: "Scalar" },
      { name: "center", ty: "Point" },
    ],
  },

  // patternCircular3d - Circular 3D pattern
  patternCircular3d: {
    ret: "Shape",
    params: [
      { name: "features", ty: "Shape" },
      { name: "count", ty: "Scalar" },
      { name: "axis", ty: "Point" },
      { name: "center", ty: "Point" },
    ],
  },

  // patternTransform2d - Transform-based 2D pattern
  patternTransform2d: {
    ret: "Sketch",
    params: [
      { name: "entities", ty: "Sketch" },
      { name: "transforms", ty: "Scalar" }, // Should be transform array
    ],
  },

  // patternTransform - Transform-based 3D pattern
  patternTransform: {
    ret: "Shape",
    params: [
      { name: "features", ty: "Shape" },
      { name: "transforms", ty: "Scalar" }, // Should be transform array
    ],
  },

  // === TODO: std::transform - Geometric Transforms ===

  // TODO: rotate - Rotate around axis
  rotate: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "axis", ty: "Point" },
      { name: "angle", ty: "Scalar" },
    ],
  },

  // TODO: scale - Uniform or non-uniform scale
  scale: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "factor", ty: "Scalar" },
      { name: "x", ty: "Scalar", optional: true },
      { name: "y", ty: "Scalar", optional: true },
      { name: "z", ty: "Scalar", optional: true },
    ],
  },

  // TODO: mirror2d - 2D mirror
  mirror2d: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "axis", ty: "Point" },
    ],
  },

  // TODO: mirror - 3D mirror
  mirror: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "plane", ty: "Plane" },
    ],
  },

  // === TODO: std::vector - Vector Operations ===

  // TODO: add - Vector addition
  vectorAdd: {
    ret: "Point",
    params: [
      { name: "a", ty: "Point" },
      { name: "b", ty: "Point" },
    ],
  },

  // TODO: sub - Vector subtraction
  vectorSub: {
    ret: "Point",
    params: [
      { name: "a", ty: "Point" },
      { name: "b", ty: "Point" },
    ],
  },

  // TODO: mul - Vector scalar multiplication
  vectorMul: {
    ret: "Point",
    params: [
      { name: "vector", ty: "Point" },
      { name: "scalar", ty: "Scalar" },
    ],
  },

  // TODO: dot - Vector dot product
  vectorDot: {
    ret: "Scalar",
    params: [
      { name: "a", ty: "Point" },
      { name: "b", ty: "Point" },
    ],
  },

  // TODO: cross - Vector cross product
  vectorCross: {
    ret: "Point",
    params: [
      { name: "a", ty: "Point" },
      { name: "b", ty: "Point" },
    ],
  },

  // TODO: magnitude - Vector magnitude
  vectorMagnitude: {
    ret: "Scalar",
    params: [
      { name: "vector", ty: "Point" },
    ],
  },

  // TODO: normalize - Vector normalization
  vectorNormalize: {
    ret: "Point",
    params: [
      { name: "vector", ty: "Point" },
    ],
  },

  // === std::array - Array Operations ===

  // array::concat - Concatenate two arrays
  "array::concat": {
    ret: "Point", // Should be generic array
    params: [
      { name: "array", ty: "Point" },
      { name: "items", ty: "Point" },
    ],
  },

  // array::count - Get array length
  "array::count": {
    ret: "Scalar",
    params: [
      { name: "array", ty: "Point" },
    ],
  },

  // array::map - Apply function to each element
  "array::map": {
    ret: "Point", // Should be generic array
    params: [
      { name: "array", ty: "Point" },
      { name: "f", ty: "Scalar" }, // Should be function type
    ],
  },

  // array::reduce - Reduce array to single value
  "array::reduce": {
    ret: "Scalar", // Should be generic
    params: [
      { name: "array", ty: "Point" },
      { name: "initial", ty: "Scalar" },
      { name: "f", ty: "Scalar" }, // Should be function type
    ],
  },

  // array::push - Add element to end of array
  "array::push": {
    ret: "Point", // Should be generic array
    params: [
      { name: "array", ty: "Point" },
      { name: "item", ty: "Scalar" },
    ],
  },

  // array::pop - Remove last element from array
  "array::pop": {
    ret: "Point", // Should be generic array
    params: [
      { name: "array", ty: "Point" },
    ],
  },

  // Legacy names for backward compatibility
  arrayConcat: {
    ret: "Point",
    params: [
      { name: "a", ty: "Point" },
      { name: "b", ty: "Point" },
    ],
  },
  arrayCount: {
    ret: "Scalar",
    params: [
      { name: "array", ty: "Point" },
    ],
  },
  arrayMap: {
    ret: "Point",
    params: [
      { name: "array", ty: "Point" },
      { name: "fn", ty: "Scalar" },
    ],
  },
  arrayReduce: {
    ret: "Scalar",
    params: [
      { name: "array", ty: "Point" },
      { name: "fn", ty: "Scalar" },
      { name: "initial", ty: "Scalar" },
    ],
  },
  arrayPush: {
    ret: "Point",
    params: [
      { name: "array", ty: "Point" },
      { name: "element", ty: "Scalar" },
    ],
  },
  arrayPop: {
    ret: "Point",
    params: [
      { name: "array", ty: "Point" },
    ],
  },

  // === TODO: Logarithmic (additional) ===

  // TODO: ln - Natural logarithm
  ln: {
    ret: "Scalar",
    params: [{ name: "input", ty: "Scalar" }],
  },

  // === std::hole - Hole Operations ===

  // hole - Create single hole
  hole: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "diameter", ty: "Scalar" },
      { name: "depth", ty: "Scalar" },
      { name: "position", ty: "Point" },
    ],
  },

  // holes - Create multiple holes
  holes: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "diameter", ty: "Scalar" },
      { name: "depth", ty: "Scalar" },
      { name: "positions", ty: "Point" }, // Array of positions
    ],
  },

  // counterbore - Counterbored hole for socket head cap screws
  counterbore: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "diameter", ty: "Scalar" },
      { name: "depth", ty: "Scalar" },
      { name: "boreDepth", ty: "Scalar" },
      { name: "boreDiameter", ty: "Scalar" },
      { name: "position", ty: "Point" },
    ],
  },

  // countersink - Countersunk hole for flat head screws
  countersink: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "diameter", ty: "Scalar" },
      { name: "depth", ty: "Scalar" },
      { name: "sinkAngle", ty: "Scalar" },
      { name: "position", ty: "Point" },
    ],
  },

  // blind - Modifier for blind holes (returns metadata)
  blind: {
    ret: "Scalar",
    params: [
      { name: "depth", ty: "Scalar" },
    ],
  },

  // holesLinear - Linear hole pattern
  holesLinear: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "diameter", ty: "Scalar" },
      { name: "depth", ty: "Scalar" },
      { name: "count", ty: "Scalar" },
      { name: "spacing", ty: "Scalar" },
      { name: "direction", ty: "Point" },
      { name: "start", ty: "Point" },
    ],
  },

  // drill - Drill modifier for holes (metadata)
  drill: {
    ret: "Scalar",
    params: [
      { name: "diameter", ty: "Scalar" },
    ],
  },

  // flat - Flat-bottom hole modifier (metadata)
  flat: {
    ret: "Scalar",
    params: [
      { name: "diameter", ty: "Scalar" },
    ],
  },

  // thread - Threaded hole (visual representation)
  thread: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "diameter", ty: "Scalar" },
      { name: "pitch", ty: "Scalar" },
      { name: "depth", ty: "Scalar" },
      { name: "position", ty: "Point" },
    ],
  },

  // tap - Tapped hole (metadata)
  tap: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "diameter", ty: "Scalar" },
      { name: "pitch", ty: "Scalar" },
      { name: "depth", ty: "Scalar" },
      { name: "position", ty: "Point" },
    ],
  },

  // ream - Reamed hole for precision (metadata)
  ream: {
    ret: "Shape",
    params: [
      { name: "shape", ty: "Shape" },
      { name: "diameter", ty: "Scalar" },
      { name: "depth", ty: "Scalar" },
      { name: "position", ty: "Point" },
    ],
  },

  // simple - Simple hole type (no decoration)
  simple: {
    ret: "Scalar",
    params: [],
  },

  // === std::appearance - Appearance Functions ===

  // hexString - Convert RGB array to hex color string
  hexString: {
    ret: "Scalar",
    params: [
      { name: "rgb", ty: "Point" }, // Array of 3 numbers [r, g, b]
    ],
  },
  "appearance::hexString": {
    ret: "Scalar",
    params: [
      { name: "rgb", ty: "Point" },
    ],
  },

  // === std::gdt - GD&T Functions ===

  // datum - GD&T datum annotation
  datum: {
    ret: "Scalar",
    params: [
      { name: "face", ty: "Scalar" },
      { name: "name", ty: "Scalar" },
      { name: "framePosition", ty: "Point", optional: true },
      { name: "framePlane", ty: "Plane", optional: true },
      { name: "fontPointSize", ty: "Scalar", optional: true },
      { name: "fontScale", ty: "Scalar", optional: true },
    ],
  },
  "gdt::datum": {
    ret: "Scalar",
    params: [
      { name: "face", ty: "Scalar" },
      { name: "name", ty: "Scalar" },
      { name: "framePosition", ty: "Point", optional: true },
      { name: "framePlane", ty: "Plane", optional: true },
      { name: "fontPointSize", ty: "Scalar", optional: true },
      { name: "fontScale", ty: "Scalar", optional: true },
    ],
  },

  // flatness - GD&T flatness annotation
  flatness: {
    ret: "Scalar",
    params: [
      { name: "faces", ty: "Point" }, // Array of faces
      { name: "tolerance", ty: "Scalar" },
      { name: "precision", ty: "Scalar", optional: true },
      { name: "framePosition", ty: "Point", optional: true },
      { name: "framePlane", ty: "Plane", optional: true },
      { name: "fontPointSize", ty: "Scalar", optional: true },
      { name: "fontScale", ty: "Scalar", optional: true },
    ],
  },
  "gdt::flatness": {
    ret: "Scalar",
    params: [
      { name: "faces", ty: "Point" },
      { name: "tolerance", ty: "Scalar" },
      { name: "precision", ty: "Scalar", optional: true },
      { name: "framePosition", ty: "Point", optional: true },
      { name: "framePlane", ty: "Plane", optional: true },
      { name: "fontPointSize", ty: "Scalar", optional: true },
      { name: "fontScale", ty: "Scalar", optional: true },
    ],
  },

  // === Utility Functions ===

  // clone - Clone a sketch or solid
  clone: {
    ret: "Shape",
    params: [
      { name: "geometry", ty: "Shape" },
    ],
  },

  // helix - Create a helix path
  helix: {
    ret: "Sketch",
    params: [
      { name: "revolutions", ty: "Scalar" },
      { name: "angleStart", ty: "Scalar" },
      { name: "ccw", ty: "Scalar", optional: true },
      { name: "radius", ty: "Scalar", optional: true },
      { name: "axis", ty: "Scalar", optional: true },
      { name: "length", ty: "Scalar", optional: true },
      { name: "cylinder", ty: "Shape", optional: true },
    ],
  },

  // offsetPlane - Offset a plane along its normal
  offsetPlane: {
    ret: "Plane",
    params: [
      { name: "plane", ty: "Plane" },
      { name: "offset", ty: "Scalar" },
    ],
  },

  // angledLineThatIntersects - Draw angled line that intersects
  angledLineThatIntersects: {
    ret: "Sketch",
    params: [
      { name: "sketch", ty: "Sketch" },
      { name: "angle", ty: "Scalar" },
      { name: "intersectTag", ty: "Scalar" },
      { name: "offset", ty: "Scalar", optional: true },
      { name: "tag", ty: "Scalar", optional: true },
    ],
  },

  // === std::units - Unit Conversion Functions ===

  // toMillimeters - Convert to millimeters
  toMillimeters: {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },
  "units::toMillimeters": {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },

  // toCentimeters - Convert to centimeters
  toCentimeters: {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },
  "units::toCentimeters": {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },

  // toMeters - Convert to meters
  toMeters: {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },
  "units::toMeters": {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },

  // toInches - Convert to inches
  toInches: {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },
  "units::toInches": {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },

  // toFeet - Convert to feet
  toFeet: {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },
  "units::toFeet": {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },

  // toYards - Convert to yards
  toYards: {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },
  "units::toYards": {
    ret: "Scalar",
    params: [
      { name: "num", ty: "Scalar" },
    ],
  },
}
