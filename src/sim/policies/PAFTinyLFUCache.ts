// Layman's terms for this policy:
// Probabilistic Admission using TinyLFU frequency estimates.
// When full, admit an item only if its estimated frequency >= victim's estimate.

import type { Alert } from '../types';
import { CachePolicy, isExpired } from './base';
import { FrequencySketch } from './frequency-sketch';

// Probabilistic Admission using TinyLFU frequency estimates.
// When full, admit an item only if its estimated frequency >= victim's estimate.
export class PAFTinyLFUCache implements CachePolicy {
  readonly name = 'PAFTinyLFU';
  private cap: number;
  private map = new Map<string, Alert>();
  private order: string[] = []; // simple recency for victim selection
  private sketch: FrequencySketch;

  // Initialize with given capacity and a frequency sketch
  constructor(capacity: number) {
    this.cap = capacity;
    this.sketch = new FrequencySketch(4096);
  }

  // Remove expired alerts from the cache
  private purgeExpired(now: number) {
    for (const id of [...this.map.keys()]) {
      const a = this.map.get(id)!;
      if (isExpired(a, now)) {
        this.map.delete(id);
        const idx = this.order.indexOf(id);
        if (idx >= 0) this.order.splice(idx, 1);
      }
    }
  }
  // Update the order of the accessed alert and increment its frequency
  private touch(id: string) {
    const idx = this.order.indexOf(id);
    if (idx >= 0) this.order.splice(idx, 1);
    this.order.push(id);
    this.sketch.increment(id);
  }

  put(a: Alert, now: number): void {
    this.purgeExpired(now);
    // Update frequency for admission key (threadKey preferred)
    const key = a.threadKey ?? a.id;
    this.sketch.increment(key);

    if (this.map.size < this.cap) {
      this.map.set(a.id, a);
      this.touch(a.id);
      return;
    }

    // Choose least frequent among a sample of oldest few
    const sample = this.order.slice(0, Math.min(8, this.order.length));
    let victimId = sample[0];
    let victimScore = this.sketchEstimateFor(victimId);
    for (const id of sample) {
      const s = this.sketchEstimateFor(id);
      if (s < victimScore) {
        victimId = id;
        victimScore = s;
      }
    }

    // Admit if candidate's freq >= victim's freq
    const candScore = this.sketch.estimate(key);
    if (candScore >= victimScore) {
      if (victimId) {
        this.map.delete(victimId);
        const idx = this.order.indexOf(victimId);
        if (idx >= 0) this.order.splice(idx, 1);
      }
      this.map.set(a.id, a);
      this.touch(a.id);
    }
    // else: reject admission
  }

  // Retrieve an alert from the cache, updating its recency
  get(id: string, now: number): Alert | undefined {
    this.purgeExpired(now);
    const a = this.map.get(id);
    if (a) this.touch(id);
    return a;
  }

  // Check if an alert is in the cache
  has(id: string, now: number): boolean {
    return !!this.get(id, now);
  }
  // Current number of alerts in the cache
  size(): number {
    return this.map.size;
  }

  // Get all current alerts in the cache
  entries(now: number): Alert[] {
    this.purgeExpired(now);
    return [...this.map.values()];
  }

  // Get sketch estimate for a given id
  private sketchEstimateFor(id: string) {
    return this.sketch.estimate(id);
  }
}

