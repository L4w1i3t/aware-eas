import Dexie, { Table } from 'dexie';
import type { SeedMode, RunResult } from './sim/run';

export type Report = {
  id: string;
  eventType: string;
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Extreme' | 'Unknown';
  urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';
  certainty?: string;
  polygon?: string;
  issuedAt: number;
  expiresAt: number;
  headline?: string;
  instruction?: string;
  sizeBytes?: number;
  geokey?: string;
  regionId?: string;
};

export type Shelter = {
  id: string;
  name: string;
  address?: string;
  coordinates: [number, number];
  capacity?: number;
  status: 'open' | 'full' | 'closed';
  updatedAt: number;
  geokey?: string;
  regionId?: string;
};

export type RunMeta = {
  id: string;
  scenario: string;
  policy: string;
  seed: string;
  timestamp: number;
  metrics: any;
  samplesCount: number;
  experimentName?: string;
  notes?: string;
  fullResults?: RunResult;
  batchId?: string;
  seedMode?: SeedMode;
  replicateIndex?: number;
  replicates?: number;
};

export type KV = { key: string; value: string };

export class AwareDB extends Dexie {
  reports!: Table<Report, string>;
  shelters!: Table<Shelter, string>;
  runs!: Table<RunMeta, string>;
  kvs!: Table<KV, string>;

  constructor() {
    super('awareDB');
    this.version(1).stores({
      reports: 'id, issuedAt, expiresAt, severity, urgency, geokey, eventType',
      shelters: 'id, geokey, status, updatedAt, name',
      runs: 'id, timestamp, scenario, policy, seed, experimentName',
      kvs: 'key'
    });
  }
}

export const db = new AwareDB();

export async function putReports(list: Report[]) {
  return db.reports.bulkPut(list);
}
export async function putShelters(list: Shelter[]) {
  return db.shelters.bulkPut(list);
}
export async function logRun(run: RunMeta) {
  return db.runs.put(run);
}
export async function setKV(key: string, value: string) {
  return db.kvs.put({ key, value });
}
