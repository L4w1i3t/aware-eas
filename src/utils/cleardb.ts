// Utility to clear database when needed
import { db } from '../db';

export async function clearDatabase() {
  try {
    await db.delete();
    console.log('Database cleared successfully');
    window.location.reload(); // Refresh to recreate database
  } catch (error) {
    console.error('Failed to clear database:', error);
  }
}

// Add to window for manual debugging
if (typeof window !== 'undefined') {
  (window as any).clearDB = clearDatabase;
}
