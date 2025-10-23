// Layman's terms for this policy:
// Keep the cache full of the most recently used alerts.
// When adding a new alert to a full cache, evict the least recently used alert.

import type { Alert } from '../types';
import { CachePolicy, isExpired } from './base';

// Keep the cache full of the most recently used alerts.
export class LRU implements CachePolicy {
  readonly name = 'LRU';
  private cap: number;
  private map = new Map<string, Alert>();
  private order: string[] = []; // most recent at end

  constructor(capacity: number) {
    this.cap = capacity;
  }

  private touch(id: string) {
    const idx = this.order.indexOf(id);
    if (idx >= 0) this.order.splice(idx, 1);
    this.order.push(id);
  }

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

  // Add a new alert to the cache
  put(a: Alert, now: number): void {
    this.purgeExpired(now);
    this.map.set(a.id, a);
    this.touch(a.id);
    while (this.map.size > this.cap) {
      const evictId = this.order.shift();
      if (evictId) this.map.delete(evictId);
      else break;
    }
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
}

