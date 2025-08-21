import type { CacheEntry, CachePolicy } from '@sim/models/cache';

export function lru(capacityBytes = 50_000): CachePolicy {
  const map = new Map<string, CacheEntry>();
  let used = 0;
  function touch(key: string) { const e = map.get(key); if(!e) return; map.delete(key); map.set(key, e); }
  function evictIfNeeded() {
    while (used > capacityBytes && map.size) {
      const firstKey = map.keys().next().value as string;
      const e = map.get(firstKey)!; map.delete(firstKey); used -= e.bytes;
    }
  }
  return {
    name: 'LRU',
    get(key, _now) { const e = map.get(key); if (!e) return; touch(key); return e; },
    put(entry, _now) { const ex = map.get(entry.key); if (ex) { used -= ex.bytes; map.delete(entry.key); }
      map.set(entry.key, entry); used += entry.bytes; evictIfNeeded(); },
    evictIfNeeded(_now) { evictIfNeeded(); },
    sizeBytes() { return used; }
  };
}
