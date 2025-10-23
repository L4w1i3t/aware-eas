// Layman's terms for this policy:
// Keep the cache full of the most recent alerts, evicting only when necessary.

import type { Alert } from '../types';
import { CachePolicy, isExpired } from './base';

export class TTLOnly implements CachePolicy {
  readonly name = 'TTLOnly';
  private cap: number;
  private map = new Map<string, Alert>();
  private order: string[] = []; // insertion order

  // Initialize with given capacity
  constructor(capacity: number) {
    this.cap = capacity;
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
  // Add a new alert to the cache
  put(a: Alert, now: number): void {
    this.purgeExpired(now);
    this.map.set(a.id, a);
    this.order.push(a.id);
    while (this.map.size > this.cap) {
      // TTL-only prefers to wait for expiry; if over cap, evict oldest inserted
      const evictId = this.order.shift();
      if (evictId) this.map.delete(evictId);
      else break;
    }
  }
  // Retrieve an alert from the cache
  get(id: string, now: number): Alert | undefined {
    this.purgeExpired(now);
    return this.map.get(id);
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

