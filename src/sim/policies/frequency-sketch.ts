/**
 * Frequency Sketch for TinyLFU admission control
 * Uses Count-Min Sketch for approximate frequency counting with aging
 */
export class FrequencySketch {
  private counters: Uint8Array[];
  private width: number;
  private depth: number;
  private size: number;
  private sampleSize: number;
  private tableMask: number;

  constructor(expectedItems: number = 1000) {
    // Calculate optimal width and depth for Count-Min Sketch
    this.width = Math.max(4, Math.ceil(expectedItems / 4));
    this.depth = 4;
    this.size = 0;
    this.sampleSize = 10 * expectedItems;
    this.tableMask = this.width - 1;

    // Initialize counter tables
    this.counters = [];
    for (let i = 0; i < this.depth; i++) {
      this.counters.push(new Uint8Array(this.width));
    }
  }

  /**
   * Record access to an item
   */
  increment(key: string): void {
    const hashes = this.hash(key);
    
    for (let i = 0; i < this.depth; i++) {
      const index = hashes[i] & this.tableMask;
      if (this.counters[i][index] < 15) { // Max value for 4-bit counter
        this.counters[i][index]++;
      }
    }

    this.size++;
    
    // Periodic aging to prevent saturation
    if (this.size >= this.sampleSize) {
      this.reset();
    }
  }

  /**
   * Get estimated frequency of an item
   */
  estimate(key: string): number {
    const hashes = this.hash(key);
    let min = 15;

    for (let i = 0; i < this.depth; i++) {
      const index = hashes[i] & this.tableMask;
      min = Math.min(min, this.counters[i][index]);
    }

    return min;
  }

  /**
   * Reset counters with aging (divide by 2)
   */
  private reset(): void {
    for (let i = 0; i < this.depth; i++) {
      for (let j = 0; j < this.width; j++) {
        this.counters[i][j] = Math.floor(this.counters[i][j] / 2);
      }
    }
    this.size = 0;
  }

  /**
   * Generate hash values for Count-Min Sketch
   */
  private hash(key: string): number[] {
    // Simple hash function - in production, use stronger hashing
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) & 0xffffffff;
    }

    const hashes: number[] = [];
    for (let i = 0; i < this.depth; i++) {
      hashes.push(Math.abs(hash + i * 0x9e3779b9) >>> 0);
    }

    return hashes;
  }

  /**
   * Serialize sketch for persistence
   */
  serialize(): string {
    const data = {
      counters: this.counters.map(arr => Array.from(arr)),
      width: this.width,
      depth: this.depth,
      size: this.size,
      sampleSize: this.sampleSize
    };
    return JSON.stringify(data);
  }

  /**
   * Deserialize sketch from persistence
   */
  static deserialize(data: string): FrequencySketch {
    const parsed = JSON.parse(data);
    const sketch = new FrequencySketch();
    
    sketch.width = parsed.width;
    sketch.depth = parsed.depth;
    sketch.size = parsed.size;
    sketch.sampleSize = parsed.sampleSize;
    sketch.tableMask = sketch.width - 1;
    
    sketch.counters = parsed.counters.map((arr: number[]) => new Uint8Array(arr));
    
    return sketch;
  }
}
