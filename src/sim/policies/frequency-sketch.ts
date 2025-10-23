// Simple Count-Min Sketch for TinyLFU-like admission decisions
export class FrequencySketch {
  private size: number;
  private a: Uint16Array;
  private b: Uint16Array;
  private c: Uint16Array;
  private d: Uint16Array;

  constructor(size = 2048) {
    // size must be a power of two for fast masking
    this.size = 1 << Math.ceil(Math.log2(Math.max(16, size)));
    this.a = new Uint16Array(this.size);
    this.b = new Uint16Array(this.size);
    this.c = new Uint16Array(this.size);
    this.d = new Uint16Array(this.size);
  }

  // Estimate frequency for an existing key (not incrementing)
  increment(key: string) {
    const h = this.hash(key);
    this.a[h & (this.size - 1)]++;
    this.b[(h >>> 8) & (this.size - 1)]++;
    this.c[(h >>> 16) & (this.size - 1)]++;
    this.d[(h >>> 24) & (this.size - 1)]++;
  }

  // Estimate frequency for a key
  estimate(key: string): number {
    const h = this.hash(key);
    const e1 = this.a[h & (this.size - 1)];
    const e2 = this.b[(h >>> 8) & (this.size - 1)];
    const e3 = this.c[(h >>> 16) & (this.size - 1)];
    const e4 = this.d[(h >>> 24) & (this.size - 1)];
    return Math.min(e1, e2, e3, e4);
  }

  // FNV-1a hash
  private hash(key: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // final mix
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
    return h >>> 0;
  }
}

