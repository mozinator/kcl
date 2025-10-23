/**
 * Property Testing Framework
 *
 * Core functions for running property tests: check, forAll, assertProperty
 */

import { Random } from "./random"
import type { Generator } from "./generator"

/**
 * A Property is an assertion about a value
 */
export type Property<T> = (value: T) => void | Promise<void>

/**
 * Configuration for property tests
 */
export interface CheckOptions {
  /** Number of test runs (default: 100) */
  runs?: number
  /** RNG seed for reproducibility */
  seed?: number
  /** Log every test case */
  verbose?: boolean
  /** Timeout per test in milliseconds */
  timeout?: number
}

/**
 * Result of a property test run
 */
export interface CheckResult {
  runs: number
  seed: number
  passed: boolean
  failedOn?: {
    run: number
    seed: number
    value: any
    error: Error
  }
}

/**
 * Run a property test
 *
 * Generates random values using the generator and checks the property holds for each.
 * Returns a result object with success/failure info.
 *
 * @param gen Generator for test values
 * @param prop Property to check
 * @param options Test configuration
 * @returns CheckResult with pass/fail info
 *
 * @example
 * check(
 *   Primitives.int(0, 100),
 *   (n) => expect(n * 2).toBeGreaterThanOrEqual(n),
 *   { runs: 1000 }
 * )
 */
export function check<T>(
  gen: Generator<T>,
  prop: Property<T>,
  options: CheckOptions = {}
): CheckResult {
  const runs = options.runs ?? 100
  const seed = options.seed ?? Date.now()
  const verbose = options.verbose ?? false

  for (let i = 0; i < runs; i++) {
    const runSeed = seed + i
    const rng = new Random(runSeed)
    const value = gen(rng)

    if (verbose) {
      console.log(`Run ${i + 1}/${runs} (seed: ${runSeed})`)
      console.log(JSON.stringify(value, null, 2))
    }

    try {
      prop(value)
    } catch (error) {
      return {
        runs: i + 1,
        seed,
        passed: false,
        failedOn: {
          run: i,
          seed: runSeed,
          value,
          error: error as Error
        }
      }
    }
  }

  return { runs, seed, passed: true }
}

/**
 * Alias for check() with a more declarative name
 *
 * @example
 * forAll(
 *   Primitives.int(0, 100),
 *   (n) => expect(n).toBeGreaterThanOrEqual(0)
 * )
 */
export const forAll = check

/**
 * Helper for test frameworks - throws on failure with detailed error message
 *
 * Use this in your test files instead of check() to get automatic test failures.
 *
 * @param gen Generator for test values
 * @param prop Property to check
 * @param options Test configuration
 * @throws Error with detailed failure info if property fails
 *
 * @example
 * test("all positive numbers stay positive when doubled", () => {
 *   assertProperty(
 *     Primitives.int(1, 100),
 *     (n) => expect(n * 2).toBeGreaterThan(0),
 *     { runs: 1000 }
 *   )
 * })
 */
export function assertProperty<T>(
  gen: Generator<T>,
  prop: Property<T>,
  options: CheckOptions = {}
): void {
  const result = check(gen, prop, options)

  if (!result.passed && result.failedOn) {
    const { run, seed, value, error } = result.failedOn

    // Pretty-print the failure
    const lines = [
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "  Property Test Failure",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `Failed on run ${run + 1}/${result.runs}`,
      `Seed: ${seed}`,
      "",
      "Failing input:",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      JSON.stringify(value, null, 2),
      "",
      "Error:",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      error.message,
      "",
      "To reproduce:",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `  check(gen, prop, { seed: ${seed}, runs: ${run + 1} })`,
      ""
    ]

    console.error(lines.join("\n"))

    throw error
  }
}

/**
 * Sample generator output (for debugging generators)
 *
 * @param gen Generator to sample
 * @param count Number of samples
 * @param seed RNG seed
 * @returns Array of generated values
 *
 * @example
 * // See what your generator produces
 * sample(arbValidSSAIR(), 10).forEach(ir => console.log(ir))
 */
export function sample<T>(gen: Generator<T>, count = 10, seed = Date.now()): T[] {
  const results: T[] = []
  for (let i = 0; i < count; i++) {
    const rng = new Random(seed + i)
    results.push(gen(rng))
  }
  return results
}

/**
 * Print sample generator output (for debugging)
 *
 * @param gen Generator to sample
 * @param count Number of samples
 * @param seed RNG seed
 *
 * @example
 * printSamples(arbValidSSAIR(), 5)
 */
export function printSamples<T>(gen: Generator<T>, count = 10, seed = Date.now()): void {
  console.log(`Sampling ${count} values (seed: ${seed}):\n`)
  const samples = sample(gen, count, seed)
  samples.forEach((value, i) => {
    console.log(`━━━ Sample ${i + 1} ━━━`)
    console.log(JSON.stringify(value, null, 2))
    console.log()
  })
}
