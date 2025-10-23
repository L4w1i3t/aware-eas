import type { Alert } from '../types';

export interface CachePolicy {
  readonly name: string;
  put(a: Alert, now: number): void;
  get(id: string, now: number): Alert | undefined;
  has(id: string, now: number): boolean;
  size(): number;
  entries(now: number): Alert[];
}

export function isExpired(a: Alert, now: number) {
  return now >= a.issuedAt + a.ttlSec;
}
