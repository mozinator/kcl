/**
 * Primitive Value Generators
 *
 * Common generators for basic types: numbers, strings, booleans, arrays, etc.
 */

import type { Generator } from "./generator"

/**
 * Primitive value generators
 */
export const Primitives = {
  /**
   * Integer in range [min, max)
   */
  int(min: number, max: number): Generator<number> {
    return (rng) => rng.int(min, max)
  },

  /**
   * Float in range [min, max)
   */
  float(min: number, max: number): Generator<number> {
    return (rng) => rng.float(min, max)
  },

  /**
   * Boolean with optional bias
   */
  bool(probability = 0.5): Generator<boolean> {
    return (rng) => rng.bool(probability)
  },

  /**
   * String of given length range
   *
   * @param minLen Minimum string length
   * @param maxLen Maximum string length
   * @param charset Characters to choose from
   */
  string(
    minLen = 0,
    maxLen = 20,
    charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  ): Generator<string> {
    return (rng) => {
      const len = rng.int(minLen, maxLen + 1)
      return Array.from({ length: len }, () => charset[rng.int(0, charset.length)]).join("")
    }
  },

  /**
   * Alphanumeric string
   */
  alphanumeric(minLen = 0, maxLen = 20): Generator<string> {
    return Primitives.string(minLen, maxLen, "abcdefghijklmnopqrstuvwxyz0123456789")
  },

  /**
   * Identifier-like string (starts with letter, contains letters/numbers/_)
   */
  identifier(minLen = 1, maxLen = 20): Generator<string> {
    return (rng) => {
      const first = "abcdefghijklmnopqrstuvwxyz"[rng.int(0, 26)]!
      const rest = Primitives.string(
        Math.max(0, minLen - 1),
        Math.max(0, maxLen - 1),
        "abcdefghijklmnopqrstuvwxyz0123456789_"
      )(rng)
      return first + rest
    }
  },

  /**
   * Array of values
   *
   * @param elementGen Generator for array elements
   * @param minLen Minimum array length
   * @param maxLen Maximum array length
   */
  array<T>(elementGen: Generator<T>, minLen = 0, maxLen = 10): Generator<T[]> {
    return (rng) => {
      const len = rng.int(minLen, maxLen + 1)
      return Array.from({ length: len }, () => elementGen(rng))
    }
  },

  /**
   * Non-empty array
   */
  nonEmptyArray<T>(elementGen: Generator<T>, maxLen = 10): Generator<T[]> {
    return Primitives.array(elementGen, 1, maxLen)
  },

  /**
   * Array with exact length
   */
  arrayOfLength<T>(elementGen: Generator<T>, length: number): Generator<T[]> {
    return Primitives.array(elementGen, length, length)
  },

  /**
   * Pick from a list of values
   */
  elements<T>(...values: T[]): Generator<T> {
    if (values.length === 0) {
      throw new Error("elements requires at least one value")
    }
    return (rng) => rng.pick(values)
  },

  /**
   * Generate integer with edge cases
   * 20% of the time, returns an edge case value
   */
  intWithEdges(min: number, max: number, edges: number[] = []): Generator<number> {
    return (rng) => {
      const allEdges = [min, max - 1, 0, -1, 1, ...edges].filter(e => e >= min && e < max)

      if (rng.bool(0.2) && allEdges.length > 0) {
        return rng.pick(allEdges)
      }

      return rng.int(min, max)
    }
  },

  /**
   * Generate float with edge cases
   */
  floatWithEdges(min: number, max: number, edges: number[] = []): Generator<number> {
    return (rng) => {
      const allEdges = [
        min,
        max,
        0,
        -0,
        0.5,
        -0.5,
        Math.E,
        Math.PI,
        ...edges
      ].filter(e => e >= min && e <= max)

      if (rng.bool(0.2) && allEdges.length > 0) {
        return rng.pick(allEdges)
      }

      return rng.float(min, max)
    }
  },

  /**
   * Positive integer (excluding zero)
   */
  positiveInt(max = 1000): Generator<number> {
    return Primitives.int(1, max)
  },

  /**
   * Non-negative integer (including zero)
   */
  nonNegativeInt(max = 1000): Generator<number> {
    return Primitives.int(0, max)
  },

  /**
   * Negative integer
   */
  negativeInt(min = -1000): Generator<number> {
    return Primitives.int(min, 0)
  },

  /**
   * Natural number (0, 1, 2, 3, ...)
   */
  nat(max = 1000): Generator<number> {
    return Primitives.int(0, max)
  },

  /**
   * Small integer (useful for array indices, loop counts, etc.)
   */
  smallInt(max = 20): Generator<number> {
    return Primitives.int(0, max)
  },

  /**
   * Percentage (0-100)
   */
  percentage(): Generator<number> {
    return Primitives.int(0, 101)
  },

  /**
   * Ratio (0.0-1.0)
   */
  ratio(): Generator<number> {
    return Primitives.float(0, 1)
  },

  /**
   * ASCII character
   */
  asciiChar(): Generator<string> {
    return (rng) => String.fromCharCode(rng.int(32, 127))
  },

  /**
   * Letter (a-z, A-Z)
   */
  letter(): Generator<string> {
    const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return (rng) => letters[rng.int(0, letters.length)]!
  },

  /**
   * Digit character (0-9)
   */
  digit(): Generator<string> {
    return (rng) => String(rng.int(0, 10))
  }
}
