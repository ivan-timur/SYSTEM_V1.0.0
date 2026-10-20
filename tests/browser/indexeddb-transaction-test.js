import {
  SYSTEM_DB_NAME,
  SYSTEM_DB_VERSION,
  completeQuestInDatabase,
  createGoalCurriculumInDatabase,
  getGoalCurriculumFromDatabase,
  linkQuestToCurriculumInDatabase,
  openSystemDatabase
} from '../../dist/ts/storage/indexeddb.js';
import {
  LEGACY_SOURCE_KEYS,
  previewLegacyLocalStorageMigration,
  createLegacyMigrationApproval,
  migrateLegacyLocalStorageToIndexedDB
} from '../../dist/ts/storage/legacy-migration.js';

const body = document.body;
const resultNode = document.querySelector('#test-result');
let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(`Check ${checks} failed: ${message}`);
}
function equal(actual, expected, message) {
  assert(Object.is(actual, expected), `${message}; expected ${String(expected)}, got ${String(actual)}`);
}
function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}
function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    tx.onerror = () => {};
  });
}
async function deleteDatabase() {
  await requestPromise(indexedDB.deleteDatabase(SYSTEM_DB_NAME));
}
async function createVersionOneDatabaseWithoutIndexes() {
  const request = indexedDB.open(SYSTEM_DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const name of ['player', 'quests', 'xp_events', 'achievements', 'seasons', 'skills']) {
      if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
    }
    // The old xp_events store intentionally has no indexes. Schema v7 must preserve repair of the legacy indexes.
  };
  const db = await requestPromise(request);
  db.close();
}
class MemoryStorage {
  constructor(values) { this.values = new Map(values); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem() { throw new Error('The migration must never write to legacy localStorage.'); }
  removeItem() { throw new Error('The migration must never remove legacy localStorage keys.'); }
}
async function readImportedPlayer() {
  const db = await openSystemDatabase();
  try {
    const tx = db.transaction(['player', 'quests', 'xp_events', 'skills', 'stats', 'activity_history', 'migrations', 'app_state', 'goal_curricula', 'goal_evidence'], 'readonly');
    const done = transactionDone(tx);
    const get = name => requestPromise(tx.objectStore(name).getAll());
    const playerRequest = requestPromise(tx.objectStore('player').get('main'));
    const questsRequest = get('quests');
    const eventRequest = get('xp_events');
    const skillsRequest = get('skills');
    const statsRequest = get('stats');
    const historyRequest = get('activity_history');
    const migrationRequest = get('migrations');
    const streakRequest = requestPromise(tx.objectStore('app_state').get('daily-quest-streak'));
    const curriculaRequest = get('goal_curricula');
    const goalEvidenceRequest = get('goal_evidence');
    const [player, quests, events, skills, stats, history, migrations, streak, curricula, goalEvidence] = await Promise.all([
      playerRequest, questsRequest, eventRequest, skillsRequest, statsRequest, historyRequest, migrationRequest, streakRequest,
      curriculaRequest, goalEvidenceRequest
    ]);
    await done;
    return { player, quests, events, skills, stats, history, migrations, streak, curricula, goalEvidence };
  } finally { db.close(); }
}
async function runLegacyMigrationIntegration() {
  const migrationTime = new Date();
  const currentStamp = `${migrationTime.getFullYear()}-${String(migrationTime.getMonth() + 1).padStart(2, '0')}-${String(migrationTime.getDate()).padStart(2, '0')}`;
  const historyAt = new Date(migrationTime.getFullYear(), migrationTime.getMonth(), migrationTime.getDate(), 9, 0, 0).toISOString();
  const entries = [
    [LEGACY_SOURCE_KEYS.save, JSON.stringify({ player: { level: 3, xp: 44, coins: 20, rank: 'C' }, stats: { mathematics: { level: 2, xp: 9, xpRequired: 125 } }, skillProgress: { 'math-algebra-i': { level: 2, xp: 13, totalXp: 38, xpRequired: 100 } } })],
    [LEGACY_SOURCE_KEYS.dailyDate, currentStamp],
    [LEGACY_SOURCE_KEYS.dailyCompleted, JSON.stringify({ study: true })],
    [LEGACY_SOURCE_KEYS.aiDaily, JSON.stringify({ date: currentStamp, items: [{ id: 'ai-current', title: 'Recall a concept', xp: 30, coins: 4 }] })],
    [LEGACY_SOURCE_KEYS.customQuests, JSON.stringify([
      { id: 'migration-custom', title: 'Build a tool', xp: 25, coins: 3, stat: 'computer', goalId: 'migration-goal', completed: true },
      { id: 'migration-custom-active', title: 'Finish the next milestone', xp: 25, coins: 3, stat: 'computer', goalId: 'migration-goal', completed: false }
    ])],
    [LEGACY_SOURCE_KEYS.goals, JSON.stringify([{ id: 'migration-goal', title: 'Finish a milestone', status: 'active', stat: 'computer', targetCount: 2,
      evidence: [{ questId: 'migration-custom', title: 'Build a tool', at: historyAt, stat: 'computer', skillId: null, xp: 25 }] }])],
    [LEGACY_SOURCE_KEYS.bossCompleted, JSON.stringify([])],
    [LEGACY_SOURCE_KEYS.history, JSON.stringify([{ at: historyAt, type: 'custom-quest', title: 'Build a tool', questId: 'migration-custom', xp: 25, coins: 3 }])],
    [LEGACY_SOURCE_KEYS.progress, JSON.stringify({ totalXpEarned: 88, totalCustomQuestsCompleted: 1 })],
    [LEGACY_SOURCE_KEYS.questStreak, JSON.stringify({ last: currentStamp, streak: 3 })],
  ];
  const legacyStorage = new MemoryStorage(entries);
  const preview = previewLegacyLocalStorageMigration(legacyStorage, migrationTime);
  const approval = createLegacyMigrationApproval(preview, { confirmed: true, warningsAcknowledged: true }, migrationTime);
  const migrated = await migrateLegacyLocalStorageToIndexedDB(legacyStorage, approval, migrationTime);
  equal(migrated.status, 'migrated', 'first import performs the one-shot migration');
  assert(migrated.summary.questCount >= 12, 'migration carries built-in, AI, custom, goal and Boss quest records');
  equal(migrated.summary.completedQuestCount, 2, 'completed Daily and Custom records become read-only completed Quest records');
  const stored = await readImportedPlayer();
  equal(stored.player.xp, 44, 'migration preserves the existing XP aggregate without granting it again');
  equal(stored.player.coins, 20, 'migration preserves existing Coins without granting them again');
  equal(stored.player.skills['math-algebra-i'].xp, 13, 'saved Skill progress is imported');
  equal(stored.stats.length, 6, 'all six legacy Stats are imported');
  equal(stored.history.length, 1, 'legacy activity history is copied into its own store');
  equal(stored.events.length, 2, 'only completed Quest identities receive migration XP ledger events');
  equal(stored.migrations.length, 1, 'a durable migration receipt is stored');
  equal(stored.streak.lastDate, currentStamp, 'the legacy Daily Quest streak date is imported into app_state');
  equal(stored.streak.streak, 3, 'the legacy Daily Quest streak count survives migration');
  equal(stored.curricula.length, 1, 'legacy Goals are imported as typed curriculum records');
  equal(stored.goalEvidence.length, 1, 'legacy evidence is imported to the append-only ledger');
  const importedGoal = stored.curricula.find(goal => goal.id === 'migration-goal');
  equal(importedGoal.milestones.length, 2, 'legacy Goal target imports as a sequential two-milestone curriculum');
  equal(importedGoal.evidence[0].questId, 'custom-quest:migration-custom', 'historical evidence is rebound to the canonical Quest identity');
  equal(importedGoal.evidence[0].skillVerification, null, 'legacy Quest evidence does not prove Skill mastery');
  const importedLinkedQuest = stored.quests.find(quest => quest.id === 'custom-quest:migration-custom-active');
  equal(importedLinkedQuest.milestoneId, importedGoal.milestones[1].id, 'active linked Quest is bound to the next open milestone');
  const replayedQuest = await completeQuestInDatabase(`daily-quest:study:${currentStamp}`, rules, new Date(migrationTime.getTime() + 1000).toISOString());
  assert(replayedQuest.alreadyCompleted, 'a migrated completed Daily Quest cannot be rewarded again');
  const replayImport = await migrateLegacyLocalStorageToIndexedDB(legacyStorage, approval, migrationTime);
  equal(replayImport.status, 'already-migrated', 'identical legacy source is not imported twice');
  legacyStorage.values.set(LEGACY_SOURCE_KEYS.save, JSON.stringify({ player: { level: 3, xp: 44, coins: 21, rank: 'C' } }));
  const changedPreview = previewLegacyLocalStorageMigration(legacyStorage, migrationTime);
  const changedApproval = createLegacyMigrationApproval(changedPreview, { confirmed: true, warningsAcknowledged: true }, migrationTime);
  let conflictingImportRejected = false;
  try { await migrateLegacyLocalStorageToIndexedDB(legacyStorage, changedApproval, migrationTime); }
  catch (error) { conflictingImportRejected = /different source data/.test(String(error?.message || error)); }
  assert(conflictingImportRejected, 'changed legacy source is not allowed to overwrite an imported database');
  const afterConflict = await readImportedPlayer();
  equal(afterConflict.player.coins, 20, 'failed conflicting import leaves the destination unchanged');
  assert(legacyStorage.values.has(LEGACY_SOURCE_KEYS.save), 'original localStorage save remains present');

  // Phase 7: the live durable Quest command refuses to commit a linked Quest
  // unless the Goal evidence is written in the same transaction.
  let missingEvidenceRejected = false;
  try {
    await completeQuestInDatabase('custom-quest:migration-custom-active', rules, new Date(migrationTime.getTime() + 2000).toISOString());
  } catch (error) {
    missingEvidenceRejected = /must commit its curriculum evidence/.test(String(error?.message || error));
  }
  assert(missingEvidenceRejected, 'a Goal-linked Quest cannot complete through the durable command without atomic evidence');
  const unchangedAfterGate = await readImportedPlayer();
  equal(unchangedAfterGate.quests.find(quest => quest.id === 'custom-quest:migration-custom-active').status, 'available',
    'missing-evidence rejection leaves the linked Quest available');
  const openMilestoneId = unchangedAfterGate.curricula.find(goal => goal.id === 'migration-goal').milestones[1].id;
  const durableCompletion = await completeQuestInDatabase('custom-quest:migration-custom-active', rules,
    new Date(migrationTime.getTime() + 3000).toISOString(), {
      curriculumEvidence: { goalId: 'migration-goal', milestoneId: openMilestoneId, evidenceId: 'phase7-evidence-migration-custom-active' },
      statAward: { statId: 'computer', xpAmount: 25 },
      progressCounterDeltas: { totalCustomQuestsCompleted: 1 },
      activity: { type: 'custom-quest', goalId: 'migration-goal', title: 'Finish the next milestone' }
    });
  assert(!durableCompletion.alreadyCompleted, 'linked Quest and evidence are completed together');
  assert(durableCompletion.curriculumEvaluation?.readyToComplete, 'new evidence closes the legacy Goal milestone path');
  const recoveredAfterCompletion = await readImportedPlayer();
  equal(recoveredAfterCompletion.quests.find(quest => quest.id === 'custom-quest:migration-custom-active').status, 'completed',
    'Quest completion survives a database close and reopen');
  equal(recoveredAfterCompletion.curricula.find(goal => goal.id === 'migration-goal').evidence.length, 2,
    'Goal evidence snapshot survives a database close and reopen');
  equal(recoveredAfterCompletion.goalEvidence.length, 2, 'append-only evidence ledger survives a database close and reopen');
}
async function seedPlayerAndQuests(quests) {
  const db = await openSystemDatabase();
  const tx = db.transaction(['player', 'quests', 'stats', 'app_state'], 'readwrite');
  tx.objectStore('player').put({
    id: 'main', xp: 990, level: 1, coins: 2, rank: 'E', skills: {
      'skill-leveling': { id: 'skill-leveling', level: 1, xp: 90, xpRequired: 100, totalXp: 90 }
    },
    completedQuestIds: [], xpEvents: [], achievements: []
  });
  tx.objectStore('stats').put({ id: 'stat:mathematics', statId: 'mathematics', name: 'Mathematics', level: 1, xp: 90, xpRequired: 100 });
  tx.objectStore('app_state').put({ id: 'progress-counters', counters: { totalXpEarned: 0, totalLevelsGained: 0, totalStatXpEarned: 0, totalStatLevelUps: 0 }, updatedAt: '2026-10-18T00:00:00.000Z' });
  for (const quest of quests) tx.objectStore('quests').put(quest);
  await transactionDone(tx);
  db.close();
}
async function seedCompletedCoreDailyGate(date, pendingSourceId) {
  const catalog = [
    { id: 'study', title: 'Mathematics Practice', xp: 100, coins: 20, statId: 'mathematics' },
    { id: 'coding', title: 'Programming Practice', xp: 120, coins: 25, statId: 'computer' },
    { id: 'training', title: 'Physical or Mental Training', xp: 80, coins: 15 },
    { id: 'reading', title: 'Critical Reading', xp: 100, coins: 20, statId: 'unique-thinking' },
    { id: 'english', title: 'English Practice', xp: 90, coins: 15, statId: 'global-skills' },
    { id: 'planning', title: 'Planning Practice', xp: 50, coins: 10, statId: 'entrepreneurship' }
  ];
  const db = await openSystemDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['player', 'quests', 'xp_events'], 'readwrite');
      const playerStore = tx.objectStore('player');
      const questStore = tx.objectStore('quests');
      const eventStore = tx.objectStore('xp_events');
      const request = playerStore.get('main');
      request.onerror = () => reject(request.error || new Error('Could not read Player for Daily Quest gate setup'));
      request.onsuccess = () => {
        const player = request.result;
        for (const item of catalog) {
          if (item.id === pendingSourceId) continue;
          const id = `daily-quest:${item.id}:${date}`;
          const row = { id, title: item.title, status: 'completed', xpReward: item.xp, coinReward: item.coins, completedAt: `${date}T08:00:00.000Z`, ...(item.statId ? { statId: item.statId } : {}) };
          const event = { id: `quest:${id}`, questId: id, amount: item.xp, createdAt: `${date}T08:00:00.000Z` };
          player.completedQuestIds = [...new Set([...player.completedQuestIds, id])];
          if (!player.xpEvents.some(existing => existing.id === event.id)) player.xpEvents.push(event);
          questStore.put(row);
          eventStore.put(event);
        }
        playerStore.put(player);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('Could not seed completed core Daily Quests'));
      tx.onerror = () => {};
    });
  } finally { db.close(); }
}

async function readStores() {
  const db = await openSystemDatabase();
  try {
    const tx = db.transaction(['player', 'quests', 'xp_events', 'achievements', 'skills', 'stats', 'activity_history', 'app_state', 'daily_prizes'], 'readonly');
    const done = transactionDone(tx);
    const reads = {
      player: requestPromise(tx.objectStore('player').get('main')),
      quests: requestPromise(tx.objectStore('quests').getAll()),
      events: requestPromise(tx.objectStore('xp_events').getAll()),
      achievements: requestPromise(tx.objectStore('achievements').getAll()),
      skills: requestPromise(tx.objectStore('skills').getAll()),
      stats: requestPromise(tx.objectStore('stats').getAll()),
      history: requestPromise(tx.objectStore('activity_history').getAll()),
      appState: requestPromise(tx.objectStore('app_state').get('progress-counters')),
      streak: requestPromise(tx.objectStore('app_state').get('daily-quest-streak')),
      dailyPrizes: requestPromise(tx.objectStore('daily_prizes').getAll())
    };
    const values = await Promise.all(Object.values(reads));
    await done;
    return Object.fromEntries(Object.keys(reads).map((key, index) => [key, values[index]]));
  } finally { db.close(); }
}
const rules = {
  xpForNextLevel: level => level === 1 ? 1000 : level === 2 ? 1250 : 1500,
  rankForLevel: level => level >= 5 ? 'A' : level >= 2 ? 'D' : 'E',
  xpForNextStatLevel: level => 100 + (level - 1) * 25,
  xpForNextSkillLevel: level => 100 + (level - 1) * 25,
  achievementRules: [{ id: 'first-atomic-quest', predicate: player => player.completedQuestIds.length >= 1 }]
};

try {
  await deleteDatabase();
  await runLegacyMigrationIntegration();
  await deleteDatabase();
  await createVersionOneDatabaseWithoutIndexes();
  const upgraded = await openSystemDatabase();
  equal(upgraded.version, SYSTEM_DB_VERSION, 'database schema is upgraded');
  const indexStore = upgraded.transaction('xp_events', 'readonly').objectStore('xp_events');
  assert(indexStore.indexNames.contains('createdAt'), 'migration creates createdAt index');
  assert(indexStore.indexNames.contains('questId'), 'migration creates questId index');
  assert(upgraded.objectStoreNames.contains('stats'), 'schema adds the Stats store');
  assert(upgraded.objectStoreNames.contains('activity_history'), 'schema adds the activity history store');
  assert(upgraded.objectStoreNames.contains('migrations'), 'schema adds the migration receipt store');
  assert(upgraded.objectStoreNames.contains('app_state'), 'schema adds transactional progress counters');
  assert(upgraded.objectStoreNames.contains('daily_prizes'), 'schema adds daily-prize claim records');
  assert(upgraded.transaction('activity_history', 'readonly').objectStore('activity_history').indexNames.contains('eventId'), 'schema indexes activity idempotency keys');
  upgraded.close();

  await deleteDatabase();
  await createVersionOneDatabaseWithoutIndexes();
  const reupgraded = await openSystemDatabase();
  equal(reupgraded.version, SYSTEM_DB_VERSION, 'a fresh legacy v1 database can also upgrade directly to schema v7');
  reupgraded.close();
  await deleteDatabase();
  // Create a clean schema-v7 database before the isolated atomic completion checks.
  await openSystemDatabase().then(db => db.close());

  // Phase 15: verify a committed record survives closing and reopening the database.
  // This is a real-browser durability check; it does not touch localStorage or user data.
  const durabilityProbe = { id: 'phase15-durability-probe', marker: 'committed-before-close',
    xp: 1234, level: 7, rank: 'C', completedQuestIds: ['phase15-quest-probe'] };
  const durabilityWriter = await openSystemDatabase();
  try {
    const tx = durabilityWriter.transaction(['app_state'], 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore('app_state').put(durabilityProbe);
    await done;
  } finally { durabilityWriter.close(); }
  const durabilityReader = await openSystemDatabase();
  try {
    const tx = durabilityReader.transaction(['app_state'], 'readonly');
    const done = transactionDone(tx);
    const restored = await requestPromise(tx.objectStore('app_state').get('phase15-durability-probe'));
    await done;
    equal(restored.marker, 'committed-before-close', 'committed IndexedDB data survives closing and reopening');
    equal(restored.xp, 1234, 'durability probe preserves XP value across database reopen');
    equal(restored.level, 7, 'durability probe preserves Level value across database reopen');
    equal(restored.rank, 'C', 'durability probe preserves Rank value across database reopen');
    equal(restored.completedQuestIds[0], 'phase15-quest-probe', 'durability probe preserves Quest identity across database reopen');
    const cleanup = durabilityReader.transaction(['app_state'], 'readwrite');
    const cleanupDone = transactionDone(cleanup);
    cleanup.objectStore('app_state').delete('phase15-durability-probe');
    await cleanupDone;
  } finally { durabilityReader.close(); }

  await seedPlayerAndQuests([
    { id: 'quest-concurrent', title: 'Concurrent test', status: 'available', xpReward: 25, coinReward: 3, skillId: 'math-algebra-i' },
    { id: 'daily-quest:study:2026-10-18', title: 'Mathematics Practice', status: 'available', xpReward: 10, coinReward: 1, statId: 'mathematics',
      skillRewards: [{ skillId: 'math-algebra-i', xpReward: 5 }, { skillId: 'math-functions', xpReward: 3 }, { skillId: 'skill-leveling', xpReward: 25 }] },
    { id: 'daily-quest:coding:2026-10-19', title: 'Prize replay conflict', status: 'available', xpReward: 100, coinReward: 50 },
    { id: 'quest-bad-threshold', title: 'Bad threshold', status: 'available', xpReward: 10, coinReward: 1 },
    { id: 'quest-orphaned-completion', title: 'Orphaned completion', status: 'completed', xpReward: 500, coinReward: 100 },
    { id: 'daily-quest:study:2026-10-20', title: 'Coin-only stale-ledger guard', status: 'available', xpReward: 1, coinReward: 1, statId: 'mathematics' },
    { id: 'daily-quest:study:2026-10-21', title: 'Streak Day One', status: 'available', xpReward: 100, coinReward: 20, skillId: 'skill-leveling', statId: 'mathematics' },
    { id: 'daily-quest:coding:2026-10-21', title: 'Same Day Quest', status: 'available', xpReward: 120, coinReward: 25 },
    { id: 'daily-quest:study:2026-10-22', title: 'Streak Day Two', status: 'available', xpReward: 100, coinReward: 20, skillId: 'skill-leveling', statId: 'mathematics' },
    { id: 'daily-quest:study:2026-10-23', title: 'Rollback Gate', status: 'available', xpReward: 100, coinReward: 20, statId: 'mathematics' }
  ]);

  const concurrent = await Promise.all([
    completeQuestInDatabase('quest-concurrent', rules, '2026-10-18T08:00:00.000Z'),
    completeQuestInDatabase('quest-concurrent', rules, '2026-10-18T08:00:01.000Z')
  ]);
  equal(concurrent.filter(item => !item.alreadyCompleted).length, 1, 'exactly one concurrent completion grants rewards');
  equal(concurrent.filter(item => item.alreadyCompleted).length, 1, 'the concurrent replay returns a no-op result');

  let stored = await readStores();
  equal(stored.player.xp, 15, 'surplus XP is preserved after the level-up');
  equal(stored.player.level, 2, 'Player level increments exactly once');
  equal(stored.player.coins, 5, 'Coins are granted exactly once');
  equal(stored.player.skills['math-algebra-i'].xp, 25, 'Skill XP persists with player progress');
  equal(stored.events.length, 1, 'only one XP event exists for concurrent duplicate completion');
  equal(stored.achievements.length, 1, 'achievement is committed with the quest');
  equal(stored.quests.find(quest => quest.id === 'quest-concurrent').status, 'completed', 'Quest status commits with the player');
  assert(stored.events[0].id === 'quest:quest-concurrent', 'XP ledger uses the stable Quest identity');

  const replay = await completeQuestInDatabase('quest-concurrent', rules, '2026-10-18T08:01:00.000Z');
  assert(replay.alreadyCompleted, 'a later replay is a no-op');
  stored = await readStores();
  equal(stored.events.length, 1, 'later replay does not append a second XP event');
  equal(stored.player.coins, 5, 'later replay cannot add more Coins');

  await seedCompletedCoreDailyGate('2026-10-18', 'study');
  const dailyGateIds18 = ['study', 'coding', 'training', 'reading', 'english', 'planning'].map(id => `daily-quest:${id}:2026-10-18`);
  const fullEffects = await completeQuestInDatabase('daily-quest:study:2026-10-18', rules, '2026-10-18T08:10:00.000Z', {
    statAward: { statId: 'mathematics', xpAmount: 25 },
    activity: { eventId: 'v1|daily-quest|study|2026-10-18', type: 'daily-quest', title: 'Full transaction test', stat: 'mathematics' },
    progressCounterDeltas: { totalCustomQuestsCompleted: 1 },
    dailyPrize: { id: 'daily-prize:2026-10-18', date: '2026-10-18', type: 'xp-coins', title: 'Daily surprise', xpReward: 15, coinReward: 4, requiredQuestIds: dailyGateIds18 }
  });
  equal(fullEffects.player.xp, 40, 'Quest and daily-prize XP are included in one Player transition');
  equal(fullEffects.player.coins, 10, 'Quest and daily-prize Coins commit in the same transition');
  equal(fullEffects.stat.level, 2, 'Stat XP and its level-up are persisted in the same transaction');
  equal(fullEffects.stat.xp, 15, 'Stat XP overflow carries into the next level');
  equal(fullEffects.player.skills['math-algebra-i'].xp, 30, 'first explicit Skill reward commits atomically');
  equal(fullEffects.player.skills['math-functions'].xp, 3, 'second explicit Skill reward commits atomically');
  equal(fullEffects.player.skills['skill-leveling'].level, 2, 'Skill level-up is computed within the TypeScript transition');
  equal(fullEffects.player.skills['skill-leveling'].xp, 15, 'Skill XP overflow is preserved within the transaction');
  equal(fullEffects.player.skills['skill-leveling'].totalXp, 115, 'lifetime Skill XP is incremented atomically');
  equal(fullEffects.xpEvents.length, 2, 'Quest and daily-prize XP events remain separately auditable');
  equal(fullEffects.progressCounters.totalXpEarned, 50, 'XP aggregate counter is incremented atomically');
  equal(fullEffects.progressCounters.totalStatXpEarned, 25, 'Stat XP aggregate counter is incremented atomically');
  equal(fullEffects.progressCounters.totalCustomQuestsCompleted, 1, 'category counters are incremented atomically');
  assert(fullEffects.activity.eventId === 'v1|daily-quest|study|2026-10-18', 'activity history persists canonical event identity');
  stored = await readStores();
  equal(stored.history.filter(entry => entry.eventId === 'v1|daily-quest|study|2026-10-18').length, 1, 'activity history identity is unique for this command');
  equal(stored.dailyPrizes.length, 1, 'daily-prize claim is committed in the same transaction');

  const fullEffectsReplay = await completeQuestInDatabase('daily-quest:study:2026-10-18', rules, '2026-10-18T08:11:00.000Z', {
    statAward: { statId: 'mathematics', xpAmount: 25 },
    activity: { eventId: 'v1|daily-quest|study|2026-10-18', type: 'daily-quest', title: 'Full transaction test', stat: 'mathematics' },
    progressCounterDeltas: { totalCustomQuestsCompleted: 1 },
    dailyPrize: { id: 'daily-prize:2026-10-18', date: '2026-10-18', type: 'xp-coins', title: 'Daily surprise', xpReward: 15, coinReward: 4, requiredQuestIds: dailyGateIds18 }
  });
  assert(fullEffectsReplay.alreadyCompleted, 'a replay of all side effects is a no-op');
  stored = await readStores();
  equal(stored.player.xp, 40, 'full-command replay does not grant more XP');
  equal(stored.player.coins, 10, 'full-command replay does not grant more Coins');
  equal(stored.history.filter(entry => entry.eventId === 'v1|daily-quest|study|2026-10-18').length, 1, 'full-command replay does not add duplicate history');
  equal(stored.dailyPrizes.length, 1, 'full-command replay does not duplicate the daily prize');

  // Seed an existing day-19 claim to exercise the duplicate-prize guard before
  // the date-19 quest gate is evaluated.
  const duplicatePrizeDb = await openSystemDatabase();
  try {
    const tx = duplicatePrizeDb.transaction('daily_prizes', 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore('daily_prizes').put({ id: 'daily-prize:2026-10-19', date: '2026-10-19', type: 'coins', title: 'Already claimed', xpReward: 0, coinReward: 5, claimedAt: '2026-10-19T08:00:00.000Z', sourceQuestId: 'daily-quest:study:2026-10-19' });
    await done;
  } finally { duplicatePrizeDb.close(); }
  let conflictingPrizeRejected = false;
  try {
    const dailyGateIds19 = ['study', 'coding', 'training', 'reading', 'english', 'planning'].map(id => `daily-quest:${id}:2026-10-19`);
    await completeQuestInDatabase('daily-quest:coding:2026-10-19', rules, '2026-10-19T08:12:00.000Z', {
      dailyPrize: { id: 'daily-prize:2026-10-19', date: '2026-10-19', type: 'coins', title: 'Already claimed', xpReward: 0, coinReward: 5, requiredQuestIds: dailyGateIds19 }
    });
  } catch (error) { conflictingPrizeRejected = /Daily prize has already been claimed/.test(String(error?.message || error)); }
  assert(conflictingPrizeRejected, 'a second Quest cannot claim the same daily prize');
  stored = await readStores();
  equal(stored.player.xp, 40, 'duplicate daily prize failure leaves Player XP unchanged');
  equal(stored.player.coins, 10, 'duplicate daily prize failure leaves Coins unchanged');
  equal(stored.quests.find(quest => quest.id === 'daily-quest:coding:2026-10-19').status, 'available', 'duplicate prize failure leaves the second Quest available');
  equal(stored.dailyPrizes.length, 2, 'duplicate prize failure does not write a second claim for that date');

  let thresholdRejected = false;
  try {
    await completeQuestInDatabase('quest-bad-threshold', { ...rules, xpForNextLevel: () => 0 }, '2026-10-18T08:02:00.000Z');
  } catch { thresholdRejected = true; }
  assert(thresholdRejected, 'invalid progression rules abort the transaction');
  stored = await readStores();
  equal(stored.player.xp, 40, 'failed transition leaves player XP unchanged after earlier successful commands');
  equal(stored.player.coins, 10, 'failed transition leaves Coins unchanged after earlier successful commands');
  equal(stored.quests.find(quest => quest.id === 'quest-bad-threshold').status, 'available', 'failed transition leaves Quest available');
  equal(stored.events.length, 8, 'failed transition does not append a ledger event');

  let inconsistentRejected = false;
  try { await completeQuestInDatabase('quest-orphaned-completion', rules, '2026-10-18T08:03:00.000Z'); }
  catch (error) { inconsistentRejected = /consistency conflict/.test(String(error?.message || error)); }
  assert(inconsistentRejected, 'orphaned completion data fails closed');
  stored = await readStores();
  equal(stored.player.xp, 40, 'consistency conflict does not change player XP');
  equal(stored.events.length, 8, 'consistency conflict does not create an XP event');

  // A stale canonical XP event must be detected even if the chosen prize is Coins-only.
  const db = await openSystemDatabase();
  try {
    const tx = db.transaction('xp_events', 'readwrite');
    const done = transactionDone(tx);
    await requestPromise(tx.objectStore('xp_events').add({
      id: 'daily-prize:2026-10-20', questId: 'stale-legacy-prize', amount: 7, createdAt: '2026-10-18T08:20:00.000Z'
    }));
    await done;
  } finally { db.close(); }
  let coinOnlyStaleLedgerRejected = false;
  try {
    await completeQuestInDatabase('daily-quest:study:2026-10-20', rules, '2026-10-20T08:00:00.000Z', {
      dailyPrize: { id: 'daily-prize:2026-10-20', date: '2026-10-20', type: 'coins', title: 'Coins only', xpReward: 0, coinReward: 5, requiredQuestIds: ['study', 'coding', 'training', 'reading', 'english', 'planning'].map(id => `daily-quest:${id}:2026-10-20`) }
    });
  } catch (error) { coinOnlyStaleLedgerRejected = /Unexpected XP ledger record exists for a non-XP daily prize/.test(String(error?.message || error)); }
  assert(coinOnlyStaleLedgerRejected, 'Coin-only prize rejects a stale XP ledger identity instead of ignoring it');
  stored = await readStores();
  equal(stored.player.xp, 40, 'stale coin-only ledger conflict leaves Player XP unchanged');
  equal(stored.player.coins, 10, 'stale coin-only ledger conflict leaves Coins unchanged');
  equal(stored.quests.find(quest => quest.id === 'daily-quest:study:2026-10-20').status, 'available', 'stale coin-only ledger conflict leaves Quest available');
  equal(stored.dailyPrizes.length, 2, 'stale coin-only ledger conflict does not add a prize claim');
  assert(!stored.events.some(event => event.id === 'quest:daily-quest:study:2026-10-20'), 'stale coin-only ledger conflict does not append the Quest XP event');

  // Streak state and the streak-adjusted Player/Stat/Skill XP must commit as one transaction.
  const streakDayOne = await completeQuestInDatabase('daily-quest:study:2026-10-21', rules, '2026-10-21T08:00:00.000Z', {
    dailyQuestStreak: { date: '2026-10-21', sourceQuestId: 'study' },
    statAward: { statId: 'mathematics', xpAmount: 100 },
    activity: { eventId: 'v1|daily-quest|study|2026-10-21', type: 'daily-quest', title: 'Streak Day One', stat: 'mathematics' }
  });
  equal(streakDayOne.xpEvent.amount, 100, 'the first streak day awards base XP');
  equal(streakDayOne.quest.xpReward, 100, 'the saved Quest base XP remains unchanged');
  equal(streakDayOne.quest.awardedXP, 100, 'the actual award is recorded separately');
  equal(streakDayOne.dailyQuestStreak.streak, 1, 'the first core Daily Quest persists Day 1');
  equal(streakDayOne.activity.streakBonusXP, 0, 'Day 1 has no streak bonus');

  const sameDayQuest = await completeQuestInDatabase('daily-quest:coding:2026-10-21', rules, '2026-10-21T10:00:00.000Z', {
    dailyQuestStreak: { date: '2026-10-21', sourceQuestId: 'coding' },
    activity: { eventId: 'v1|daily-quest|coding|2026-10-21', type: 'daily-quest', title: 'Same Day Quest' }
  });
  equal(sameDayQuest.xpEvent.amount, 120, 'the second Quest on the same date uses the same Day 1 multiplier');
  equal(sameDayQuest.dailyQuestStreak.streak, 1, 'multiple quests in one date advance the streak only once');

  const streakDayTwo = await completeQuestInDatabase('daily-quest:study:2026-10-22', rules, '2026-10-22T08:00:00.000Z', {
    dailyQuestStreak: { date: '2026-10-22', sourceQuestId: 'study' },
    statAward: { statId: 'mathematics', xpAmount: 100 },
    activity: { eventId: 'v1|daily-quest|study|2026-10-22', type: 'daily-quest', title: 'Streak Day Two', stat: 'mathematics' }
  });
  equal(streakDayTwo.xpEvent.amount, 105, 'Day 2 awards the rounded +5 percent Player XP');
  equal(streakDayTwo.quest.xpReward, 100, 'Day 2 does not overwrite base Quest XP');
  equal(streakDayTwo.quest.awardedXP, 105, 'Day 2 stores the replay-safe awarded XP snapshot');
  equal(streakDayTwo.activity.streakBonusXP, 5, 'history audits the exact streak bonus');
  equal(streakDayTwo.activity.streakMultiplier, 1.05, 'history stores the applied multiplier');
  equal(streakDayTwo.stat.level, 3, 'streak-scaled Stat XP triggers the expected level-up');
  equal(streakDayTwo.stat.xp, 95, 'Stat XP overflow is preserved after applying the streak bonus');
  equal(streakDayTwo.player.skills['skill-leveling'].level, 3, 'streak-scaled Skill XP triggers the expected level-up');
  equal(streakDayTwo.player.skills['skill-leveling'].xp, 95, 'Skill XP overflow is preserved after applying the streak bonus');
  equal(streakDayTwo.player.skills['skill-leveling'].totalXp, 320, 'lifetime Skill XP records the two streak-scaled awards');
  equal(streakDayTwo.dailyQuestStreak.streak, 2, 'the consecutive-day streak advances to Day 2');
  equal(streakDayTwo.dailyQuestStreak.bestStreak, 2, 'the best streak advances atomically');

  const streakReplay = await completeQuestInDatabase('daily-quest:study:2026-10-22', rules, '2026-10-22T08:05:00.000Z', {
    dailyQuestStreak: { date: '2026-10-22', sourceQuestId: 'study' },
    statAward: { statId: 'mathematics', xpAmount: 100 },
    activity: { eventId: 'v1|daily-quest|study|2026-10-22', type: 'daily-quest', title: 'Streak Day Two', stat: 'mathematics' }
  });
  assert(streakReplay.alreadyCompleted, 'replaying the streak Quest is an idempotent no-op');
  stored = await readStores();
  equal(stored.streak.lastDate, '2026-10-22', 'a replay cannot change the last active date');
  equal(stored.streak.streak, 2, 'a replay cannot advance or reset the streak');
  equal(stored.quests.find(item => item.id === 'daily-quest:study:2026-10-22').awardedXP, 105, 'persisted replay identity matches the original adjusted XP');

  let streakRollbackRejected = false;
  try {
    await completeQuestInDatabase('daily-quest:study:2026-10-23', { ...rules, xpForNextLevel: () => 0 }, '2026-10-23T08:00:00.000Z', {
      dailyQuestStreak: { date: '2026-10-23', sourceQuestId: 'study' },
      statAward: { statId: 'mathematics', xpAmount: 100 },
      activity: { eventId: 'v1|daily-quest|study|2026-10-23', type: 'daily-quest', title: 'Rollback Gate', stat: 'mathematics' }
    });
  } catch { streakRollbackRejected = true; }
  assert(streakRollbackRejected, 'an invalid Player XP curve aborts the streak completion');
  stored = await readStores();
  equal(stored.streak.lastDate, '2026-10-22', 'a failed Quest transaction rolls back the streak date');
  equal(stored.streak.streak, 2, 'a failed Quest transaction rolls back the streak count');
  equal(stored.quests.find(item => item.id === 'daily-quest:study:2026-10-23').status, 'available', 'a failed streak transaction leaves the Quest available');

  // Phase 5: the linked Quest, Player/Skill progress, curriculum snapshot and
  // append-only evidence row are a single native IndexedDB transaction.
  const curriculumGoal = {
    id: 'goal-atomic-phase5', title: 'Verify an atomic curriculum path', stat: 'mathematics', completed: false,
    milestones: [{ id: 'milestone-atomic-phase5', title: 'Prove the linked skill', requiredEvidence: 1,
      requiredSkillIds: ['skill-leveling'], prerequisiteIds: [] }], evidence: []
  };
  await createGoalCurriculumInDatabase(curriculumGoal);
  const curriculumQuestId = 'quest-atomic-curriculum-phase5';
  const curriculumDB = await openSystemDatabase();
  try {
    const tx = curriculumDB.transaction(['quests'], 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore('quests').add({ id: curriculumQuestId, title: 'Complete linked curriculum mission', status: 'available',
      xpReward: 30, coinReward: 5, skillId: 'skill-leveling', skillRewards: [{ skillId: 'skill-leveling', xpReward: 30 }], stat: 'mathematics' });
    await done;
  } finally { curriculumDB.close(); }
  const linkedCurriculumQuest = await linkQuestToCurriculumInDatabase(curriculumQuestId, curriculumGoal.id, curriculumGoal.milestones[0].id);
  equal(linkedCurriculumQuest.goalId, curriculumGoal.id, 'link command persists the Goal ID on an active Quest');
  equal(linkedCurriculumQuest.milestoneId, curriculumGoal.milestones[0].id, 'link command persists the Milestone ID on an active Quest');
  const beforeCurriculum = await readStores();
  const skillXPBeforeEvidence = beforeCurriculum.player.skills['skill-leveling'].totalXp;
  const curriculumCompletion = await completeQuestInDatabase(curriculumQuestId, rules, '2026-10-24T08:00:00.000Z', {
    curriculumEvidence: { goalId: curriculumGoal.id, milestoneId: curriculumGoal.milestones[0].id, evidenceId: 'evidence-atomic-phase5',
      skillVerification: { method: 'project-review', verifiedAt: '2026-10-24T07:59:00.000Z', score: 92 } },
    activity: { type: 'quest-completion', goalId: curriculumGoal.id, title: 'Atomic curriculum test' }
  });
  assert(!curriculumCompletion.alreadyCompleted, 'the first linked curriculum completion is applied');
  assert(curriculumCompletion.curriculumEvaluation?.readyToComplete, 'verified evidence advances the Goal to completion eligibility');
  equal(curriculumCompletion.curriculumRewardIssued, false, 'evidence does not silently issue a separate Goal-completion reward');
  equal(curriculumCompletion.player.skills['skill-leveling'].totalXp, skillXPBeforeEvidence + 30, 'Skill XP and the evidence commit through the same transaction');
  const afterCurriculum = await openSystemDatabase();
  let durableGoal;
  let durableEvidence;
  let durableQuest;
  let durablePlayer;
  try {
    const tx = afterCurriculum.transaction(['goal_curricula', 'goal_evidence', 'quests', 'player'], 'readonly');
    const done = transactionDone(tx);
    const values = await Promise.all([
      requestPromise(tx.objectStore('goal_curricula').get(curriculumGoal.id)),
      requestPromise(tx.objectStore('goal_evidence').get('evidence-atomic-phase5')),
      requestPromise(tx.objectStore('quests').get(curriculumQuestId)),
      requestPromise(tx.objectStore('player').get('main'))
    ]);
    await done;
    [durableGoal, durableEvidence, durableQuest, durablePlayer] = values;
  } finally { afterCurriculum.close(); }
  equal(durableGoal.evidence.length, 1, 'Goal snapshot and its evidence list are committed together');
  equal(durableEvidence.goalId, curriculumGoal.id, 'append-only evidence ledger records its parent Goal');
  equal(durableEvidence.questId, curriculumQuestId, 'append-only evidence ledger records its source Quest');
  equal(durableQuest.status, 'completed', 'the linked Quest completion commits with Goal evidence');
  assert(durablePlayer.completedQuestIds.includes(curriculumQuestId), 'the Player completion ledger commits in the same transaction');
  const curriculumReplay = await completeQuestInDatabase(curriculumQuestId, rules, '2026-10-24T08:05:00.000Z', {
    curriculumEvidence: { goalId: curriculumGoal.id, milestoneId: curriculumGoal.milestones[0].id, evidenceId: 'evidence-atomic-phase5',
      skillVerification: { method: 'project-review', verifiedAt: '2026-10-24T07:59:00.000Z', score: 92 } }
  });
  assert(curriculumReplay.alreadyCompleted, 'replaying a linked curriculum Quest is an idempotent no-op');
  equal(curriculumReplay.curriculumGoal.evidence.length, 1, 'replay does not append a second Goal evidence item');
  const readBackCurriculum = await getGoalCurriculumFromDatabase(curriculumGoal.id);
  equal(readBackCurriculum.evidence.length, 1, 'typed Goal reads validate and return the durable curriculum');

  // A failed progression transition must not leave an evidence-only write behind.
  const rollbackGoal = {
    id: 'goal-atomic-rollback-phase5', title: 'Rollback test curriculum', stat: 'mathematics', completed: false,
    milestones: [{ id: 'milestone-atomic-rollback-phase5', title: 'Rollback milestone', requiredEvidence: 1, requiredSkillIds: [], prerequisiteIds: [] }], evidence: []
  };
  await createGoalCurriculumInDatabase(rollbackGoal);
  const rollbackQuestId = 'quest-atomic-curriculum-rollback-phase5';
  const rollbackDB = await openSystemDatabase();
  try {
    const tx = rollbackDB.transaction(['quests'], 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore('quests').add({ id: rollbackQuestId, title: 'Must roll back', status: 'available', xpReward: 20, coinReward: 2, stat: 'mathematics' });
    await done;
  } finally { rollbackDB.close(); }
  await linkQuestToCurriculumInDatabase(rollbackQuestId, rollbackGoal.id, rollbackGoal.milestones[0].id);
  const beforeRollback = await readStores();
  let curriculumRollbackRejected = false;
  try {
    await completeQuestInDatabase(rollbackQuestId, { ...rules, xpForNextLevel: () => 0 }, '2026-10-24T09:00:00.000Z', {
      curriculumEvidence: { goalId: rollbackGoal.id, milestoneId: rollbackGoal.milestones[0].id, evidenceId: 'evidence-must-rollback-phase5' }
    });
  } catch { curriculumRollbackRejected = true; }
  assert(curriculumRollbackRejected, 'invalid progression rules reject a linked curriculum completion');
  const rollbackDBRead = await openSystemDatabase();
  try {
    const tx = rollbackDBRead.transaction(['goal_curricula', 'goal_evidence', 'quests', 'player'], 'readonly');
    const done = transactionDone(tx);
    const values = await Promise.all([
      requestPromise(tx.objectStore('goal_curricula').get(rollbackGoal.id)),
      requestPromise(tx.objectStore('goal_evidence').get('evidence-must-rollback-phase5')),
      requestPromise(tx.objectStore('quests').get(rollbackQuestId)),
      requestPromise(tx.objectStore('player').get('main'))
    ]);
    await done;
    equal(values[0].evidence.length, 0, 'failed completion leaves the Goal snapshot unchanged');
    equal(values[1], undefined, 'failed completion leaves no orphan evidence row');
    equal(values[2].status, 'available', 'failed completion leaves the Quest available');
    equal(values[3].xp, beforeRollback.player.xp, 'failed completion leaves Player XP unchanged');
  } finally { rollbackDBRead.close(); }

  let mismatchedCurriculumLinkRejected = false;
  try {
    await completeQuestInDatabase(rollbackQuestId, rules, '2026-10-24T09:05:00.000Z', {
      curriculumEvidence: { goalId: curriculumGoal.id, milestoneId: curriculumGoal.milestones[0].id, evidenceId: 'evidence-wrong-goal-phase5' }
    });
  } catch (error) { mismatchedCurriculumLinkRejected = /does not match the persisted Quest link/.test(String(error?.message || error)); }
  assert(mismatchedCurriculumLinkRejected, 'a mismatched Goal/Milestone request fails closed before rewards');

  body.dataset.testStatus = 'passed';
  resultNode.textContent = `PASS — ${checks} real Chromium + IndexedDB checks passed. close/reopen durability for XP/Level/Rank/Quest identity, legacy migration, schema upgrade, concurrent duplicate guard, atomic Player/Quest/Skill/Stat/Achievement/History/Counters/Daily-Prize/Ledger writes, streak multiplier/cap-state persistence/replay/rollback, duplicate prize refusal, atomic curriculum Goal/evidence/Skill progress, curriculum replay/rollback, and fail-closed consistency checks.`;
} catch (error) {
  body.dataset.testStatus = 'failed';
  resultNode.textContent = `FAIL after ${checks} checks\n${error?.stack || error}`;
}
