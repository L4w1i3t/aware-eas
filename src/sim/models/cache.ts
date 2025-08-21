export interface CacheEntry { key: string; bytes: number; putAt: number; priority: number; ttlMs: number; }

export interface CachePolicy {
  name: string;
  get(key: string, now: number): CacheEntry | undefined;
  put(entry: CacheEntry, now: number): void;
  evictIfNeeded(now: number): void;
  sizeBytes(): number;
}
