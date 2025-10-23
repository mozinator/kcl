/**
 * Generator Type and Combinators
 *
 * A Generator<T> produces random values of type T.
 * Generators can be composed using combinators like map, flatMap, filter, etc.
 */

import type { Random } from "./random"

/**
 * A Generator produces random values of type T
 * Takes an RNG and returns a value
 */
export type Generator<T> = (rng: Random) => T

/**
 * Generator combinators - compose complex generators from simple ones
 */
export const Gen = {
  /**
   * Transform generator output
   *
   * @example
   * Gen.map(Gen.constant(5), x => x * 2) // Always returns 10
   */
  map<A, B>(gen: Generator<A>, f: (a: A) => B): Generator<B> {
    return (rng) => f(gen(rng))
  },

  /**
   * Dependent generation (flatMap/bind)
   * Use when next generator depends on previous value
   *
   * @example
   * // Generate array of random length with random elements
   * Gen.flatMap(
   *   Primitives.int(1, 5),
   *   n => Primitives.array(Primitives.int(0, 100), n, n)
   * )
   */
  flatMap<A, B>(gen: Generator<A>, f: (a: A) => Generator<B>): Generator<B> {
    return (rng) => f(gen(rng))(rng)
  },

  /**
   * Filter generated values
   * Retries up to maxTries times to find a valid value
   *
   * @example
   * Gen.filter(Primitives.int(0, 100), x => x % 2 === 0) // Even numbers
   */
  filter<T>(gen: Generator<T>, pred: (t: T) => boolean, maxTries = 100): Generator<T> {
    return (rng) => {
      for (let i = 0; i < maxTries; i++) {
        const value = gen(rng)
        if (pred(value)) return value
      }
      throw new Error(`Failed to generate valid value after ${maxTries} attempts`)
    }
  },

  /**
   * Choose one of several generators with equal probability
   *
   * @example
   * Gen.oneOf(
   *   Primitives.int(0, 10),
   *   Primitives.constant(99),
   *   Primitives.constant(-1)
   * )
   */
  oneOf<T>(...gens: Generator<T>[]): Generator<T> {
    if (gens.length === 0) {
      throw new Error("oneOf requires at least one generator")
    }
    return (rng) => rng.pick(gens)(rng)
  },

  /**
   * Constant generator (always returns same value)
   *
   * @example
   * Gen.constant(42) // Always generates 42
   */
  constant<T>(value: T): Generator<T> {
    return () => value
  },

  /**
   * Frequency-weighted choice between generators
   *
   * @example
   * Gen.frequency(
   *   [1, genRare],    // 10% chance
   *   [9, genCommon]   // 90% chance
   * )
   */
  frequency<T>(...weighted: Array<[number, Generator<T>]>): Generator<T> {
    if (weighted.length === 0) {
      throw new Error("frequency requires at least one generator")
    }

    return (rng) => {
      const total = weighted.reduce((sum, [w]) => sum + w, 0)
      let choice = rng.next() * total

      for (const [weight, gen] of weighted) {
        choice -= weight
        if (choice <= 0) return gen(rng)
      }

      // Fallback
      return weighted[weighted.length - 1]![1](rng)
    }
  },

  /**
   * Generate tuple of values
   *
   * @example
   * Gen.tuple(
   *   Primitives.int(0, 10),
   *   Primitives.string(),
   *   Primitives.bool()
   * ) // [number, string, boolean]
   */
  tuple<T extends any[]>(...gens: { [K in keyof T]: Generator<T[K]> }): Generator<T> {
    return (rng) => gens.map(g => g(rng)) as T
  },

  /**
   * Generate record/object with specified fields
   *
   * @example
   * Gen.record({
   *   x: Primitives.int(0, 10),
   *   y: Primitives.int(0, 10),
   *   name: Primitives.string()
   * })
   */
  record<T extends Record<string, any>>(
    spec: { [K in keyof T]: Generator<T[K]> }
  ): Generator<T> {
    return (rng) => {
      const result = {} as T
      for (const [key, gen] of Object.entries(spec)) {
        result[key as keyof T] = gen(rng)
      }
      return result
    }
  },

  /**
   * Generate optional value (null or value)
   *
   * @example
   * Gen.nullable(Primitives.int(0, 10), 0.2) // 20% chance of null
   */
  nullable<T>(gen: Generator<T>, nullProbability = 0.1): Generator<T | null> {
    return (rng) => {
      if (rng.bool(nullProbability)) {
        return null
      }
      return gen(rng)
    }
  },

  /**
   * Generate optional value (undefined or value)
   *
   * @example
   * Gen.optional(Primitives.string(), 0.3) // 30% chance of undefined
   */
  optional<T>(gen: Generator<T>, undefinedProbability = 0.1): Generator<T | undefined> {
    return (rng) => {
      if (rng.bool(undefinedProbability)) {
        return undefined
      }
      return gen(rng)
    }
  }
}
