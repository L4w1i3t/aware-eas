import Dexie, { type Table } from 'dexie';

export interface RunSummary {
  id: string; // `${scenario}-${policy}-${seed}-${timestamp}`
  scenario: string;
  policy: string;
  seed: string;
  timestamp: number;
  metrics: any;      // your Metrics
  samplesCount: number;
  notes?: string;
  experimentName?: string;
  fullResults?: any;
}

// Enhanced database schema for PAF-TinyLFU caching algorithm
export interface AlertRecord {
  id: string;
  alertId: string;
  alertType: string;
  priority: number;
  severity: number;
  area: string[];
  receivedAt: number;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  isDuplicate: boolean;
  shelterInfo?: string[];
}

export interface ShelterRecord {
  id: string;
  shelterId: string;
  location: { lat: number; lon: number };
  capacity: number;
  currentOccupancy: number;
  lastUpdated: number;
  alertContext: string;
  size: number;
}

export interface CacheMeta {
  id: string;
  deviceId: string;
  totalSize: number;
  maxSize: number;
  alertSegmentSize: number;
  shelterSegmentSize: number;
  protectedRatio: number;
  admissionWindowSize: number;
  frequencySketch: string; // Serialized sketch
  lastCleanup: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
}

class AwareDB extends Dexie {
  runs!: Table<RunSummary, string>;
  
  constructor() {
    super('aware-sim');
    // Simplified schema - only store simulation runs
    this.version(3).stores({
      runs: 'id, scenario, policy, seed, timestamp'
    });
    
    // Handle database errors gracefully
    this.on('blocked', () => {
      console.warn('Database upgrade blocked. Please close other tabs and refresh.');
    });
    
    this.on('versionchange', () => {
      console.warn('Database version changed. Closing connection.');
      this.close();
    });
  }
}

// Create database instance with error recovery
let dbInstance: AwareDB;
try {
  dbInstance = new AwareDB();
} catch (error) {
  console.error('Database initialization failed:', error);
  // Create a mock database that doesn't save anything
  dbInstance = {
    runs: {
      add: async () => { console.warn('Database unavailable, skipping save'); },
      toArray: async () => []
    }
  } as any;
}

export const db = dbInstance;
