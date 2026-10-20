/** Read-only integrity diagnostics for SYSTEM's IndexedDB persistence.
 * This module never repairs, deletes, migrates, or rewrites user data.
 */
import {
  openSystemDatabase,
  SYSTEM_DB_NAME,
  SYSTEM_DB_VERSION,
  SYSTEM_PLAYER_KEY,
  SYSTEM_STORES,
  type SystemStoreName,
} from './indexeddb.js';

export type StorageFindingSeverity = 'error' | 'warning';
export interface StorageFinding {
  code: string;
  severity: StorageFindingSeverity;
  message: string;
  count?: number;
}
export interface SystemDatabaseHealthReport {
  database: string;
  expectedVersion: number;
  actualVersion: number;
  inspectedAt: string;
  readOnly: true;
  status: 'empty' | 'healthy' | 'warning' | 'error';
  counts: Record<SystemStoreName, number>;
  findings: StorageFinding[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value && value.length <= 280;
}

/** Inspect the current SYSTEM database in a single readonly transaction. */
export async function inspectSystemDatabase(now = new Date()): Promise<SystemDatabaseHealthReport> {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Storage inspection timestamp is invalid.');
  const db = await openSystemDatabase();
  try {
    const snapshot = await new Promise<Record<SystemStoreName, unknown[]>>((resolve, reject) => {
      const tx = db.transaction([...SYSTEM_STORES], 'readonly');
      const values = {} as Record<SystemStoreName, unknown[]>;
      let failure: Error | undefined;
      tx.onerror = () => { failure ??= tx.error instanceof Error ? tx.error : new Error('SYSTEM storage inspection failed.'); };
      tx.onabort = () => reject(failure ?? new Error('SYSTEM storage inspection transaction was aborted.'));
      tx.oncomplete = () => failure ? reject(failure) : resolve(values);
      for (const name of SYSTEM_STORES) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => { values[name] = Array.isArray(request.result) ? request.result as unknown[] : []; };
        request.onerror = () => {
          failure ??= request.error instanceof Error ? request.error : new Error(`Could not inspect SYSTEM store: ${name}`);
          try { tx.abort(); } catch { /* Transaction may already be inactive. */ }
        };
      }
    });

    const counts = Object.fromEntries(SYSTEM_STORES.map(name => [name, snapshot[name].length])) as Record<SystemStoreName, number>;
    const findings: StorageFinding[] = [];
    const playerRows = snapshot.player.filter(isRecord);
    const player = playerRows.find(row => row.id === SYSTEM_PLAYER_KEY);
    const hasAnyProgress = SYSTEM_STORES.some(name => name !== 'migrations' && snapshot[name].length > 0);

    if (playerRows.length > 1) findings.push({ code: 'multiple-player-records', severity: 'error', message: 'More than one player record exists; SYSTEM expects one canonical player.', count: playerRows.length });
    if (!player && hasAnyProgress) findings.push({ code: 'missing-main-player', severity: 'error', message: 'Progress records exist but the canonical player record is missing.' });
    if (snapshot.player.some(row => !isRecord(row) || !validId(row.id))) {
      findings.push({ code: 'invalid-player-record', severity: 'error', message: 'At least one player record has an invalid identity.' });
    }

    const quests = new Map<string, Record<string, unknown>>();
    let invalidQuestRecords = 0;
    for (const value of snapshot.quests) {
      if (!isRecord(value) || !validId(value.id)) { invalidQuestRecords += 1; continue; }
      quests.set(value.id, value);
    }
    if (invalidQuestRecords) findings.push({ code: 'invalid-quest-records', severity: 'error', message: 'Quest records with invalid identities were found.', count: invalidQuestRecords });

    let invalidXpEvents = 0;
    let missingQuestReferences = 0;
    const eventIds = new Set<string>();
    for (const value of snapshot.xp_events) {
      if (!isRecord(value) || !validId(value.id) || !validId(value.questId)
        || typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount < 0
        || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) {
        invalidXpEvents += 1;
        continue;
      }
      if (eventIds.has(value.id)) invalidXpEvents += 1;
      eventIds.add(value.id);
      if (!quests.has(value.questId)) missingQuestReferences += 1;
    }
    if (invalidXpEvents) findings.push({ code: 'invalid-xp-events', severity: 'error', message: 'XP ledger contains malformed or repeated event identities.', count: invalidXpEvents });
    if (missingQuestReferences) findings.push({ code: 'xp-event-missing-quest', severity: 'warning', message: 'XP events refer to Quest IDs that are not present in the Quest store; review migration or historical data before repair.', count: missingQuestReferences });

    let invalidActivityRecords = 0;
    for (const value of snapshot.activity_history) {
      if (!isRecord(value) || !validId(value.id) || typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at))) invalidActivityRecords += 1;
    }
    if (invalidActivityRecords) findings.push({ code: 'invalid-activity-records', severity: 'warning', message: 'Activity history contains records with invalid identity or timestamps.', count: invalidActivityRecords });

    const meaningfulCounts = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const hasErrors = findings.some(item => item.severity === 'error');
    const hasWarnings = findings.some(item => item.severity === 'warning');
    return {
      database: SYSTEM_DB_NAME,
      expectedVersion: SYSTEM_DB_VERSION,
      actualVersion: db.version,
      inspectedAt: now.toISOString(),
      readOnly: true,
      status: meaningfulCounts === 0 ? 'empty' : hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy',
      counts,
      findings,
    };
  } finally {
    db.close();
  }
}
