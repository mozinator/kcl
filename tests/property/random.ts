/**
 * Seedable RNG with Utility Methods
 *
 * Uses xorshift algorithm for fast, deterministic random number generation.
 * Pass a seed to make tests reproducible.
 */

export class Random {
  private state: number

  constructor(seed: number = Date.now()) {
    // Ensure non-zero state
    this.state = seed >>> 0 || 1
  }

  /**
   * Next random value in [0, 1)
   * Uses xorshift algorithm
   */
  next(): number {
    this.state ^= this.state << 13
    this.state ^= this.state >> 17
    this.state ^= this.state << 5
    return ((this.state >>> 0) / 0x100000000)
  }

  /**
   * Integer in [min, max)
   */
  int(min: number, max: number): number {
    if (min >= max) {
      throw new Error(`Invalid range: [${min}, ${max})`)
    }
    return Math.floor(this.next() * (max - min)) + min
  }

  /**
   * Float in [min, max)
   */
  float(min: number, max: number): number {
    if (min >= max) {
      throw new Error(`Invalid range: [${min}, ${max})`)
    }
    return min + this.next() * (max - min)
  }

  /**
   * Pick random element from array
   */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error("Cannot pick from empty array")
    }
    return arr[this.int(0, arr.length)]!
  }

  /**
   * Boolean with probability p
   */
  bool(p: number = 0.5): boolean {
    if (p < 0 || p > 1) {
      throw new Error(`Probability must be in [0, 1], got ${p}`)
    }
    return this.next() < p
  }

  /**
   * Shuffle array (Fisher-Yates)
   * Returns a new shuffled array
   */
  shuffle<T>(arr: readonly T[]): T[] {
    const result = [...arr]
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1)
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
  }

  /**
   * Sample N elements from array without replacement
   */
  sample<T>(arr: readonly T[], n: number): T[] {
    if (n > arr.length) {
      throw new Error(`Cannot sample ${n} elements from array of length ${arr.length}`)
    }
    return this.shuffle(arr).slice(0, n)
  }

  /**
   * Weighted choice
   * Takes array of [weight, value] pairs
   *
   * @example
   * rng.weighted([[1, "rare"], [9, "common"]]) // 10% rare, 90% common
   */
  weighted<T>(choices: Array<[number, T]>): T {
    if (choices.length === 0) {
      throw new Error("Cannot choose from empty array")
    }

    const total = choices.reduce((sum, [w]) => sum + w, 0)
    if (total <= 0) {
      throw new Error("Total weight must be positive")
    }

    let r = this.next() * total

    for (const [weight, value] of choices) {
      r -= weight
      if (r <= 0) return value
    }

    // Fallback (shouldn't reach here)
    return choices[choices.length - 1]![1]
  }
}
