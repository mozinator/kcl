/**
 * Simple seeded random number generator for property-based tests
 * Uses Linear Congruential Generator (LCG)
 */
export class Random {
  private seed: number

  constructor(seed: number = Date.now()) {
    this.seed = seed
  }

  /**
   * Generate a random integer between min (inclusive) and max (inclusive)
   */
  int(min: number, max: number): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 2 ** 32
    return Math.floor(min + (this.seed / 2 ** 32) * (max - min + 1))
  }

  /**
   * Generate a random float between min (inclusive) and max (exclusive)
   */
  float(min: number, max: number): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 2 ** 32
    return min + (this.seed / 2 ** 32) * (max - min)
  }

  /**
   * Generate a random boolean
   */
  bool(probability: number = 0.5): boolean {
    return this.float(0, 1) < probability
  }

  /**
   * Pick a random element from an array
   */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)]
  }
}
