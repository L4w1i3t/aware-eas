/**
 * Enhanced random number generator for simulation harness
 * Uses the existing mulberry32 but with additional utility methods
 */

// Re-export the existing mulberry32 implementation
export function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class RandomGenerator {
  private rng: () => number;
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
    this.rng = mulberry32(seed);
  }

  // Basic 0-1 random
  next(): number {
    return this.rng();
  }

  // Integer in range [min, max)
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  // Float in range [min, max)
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  // Boolean with probability p
  nextBoolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  // Normal distribution (Box-Muller transform)
  nextGaussian(mean: number = 0, stddev: number = 1): number {
    if (this.spare !== undefined) {
      const temp = this.spare;
      this.spare = undefined;
      return temp * stddev + mean;
    }

    const u = this.next();
    const v = this.next();
    const mag = stddev * Math.sqrt(-2.0 * Math.log(u));
    this.spare = mag * Math.cos(2.0 * Math.PI * v);
    return mag * Math.sin(2.0 * Math.PI * v) + mean;
  }

  private spare?: number;

  // Exponential distribution (for arrival times)
  nextExponential(rate: number): number {
    return -Math.log(1 - this.next()) / rate;
  }

  // Choose random element from array
  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length)];
  }

  // Shuffle array in place
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Get current seed for reproducibility
  getSeed(): number {
    return this.seed;
  }

  // Reset with new seed
  reset(seed?: number): void {
    this.seed = seed ?? Date.now();
    this.rng = mulberry32(this.seed);
    this.spare = undefined;
  }
}
