/** Canonical built-in Quest catalogue shared by migration and the Daily Quest command. */
export const SYSTEM_CORE_DAILY_QUESTS = Object.freeze([
  { id: 'study', title: 'Mathematics Practice', xp: 100, coins: 20, stat: 'mathematics' },
  { id: 'coding', title: 'Programming Practice', xp: 120, coins: 25, stat: 'computer' },
  { id: 'training', title: 'Physical or Mental Training', xp: 80, coins: 15, stat: null },
  { id: 'reading', title: 'Critical Reading', xp: 100, coins: 20, stat: 'unique-thinking' },
  { id: 'english', title: 'English Practice', xp: 90, coins: 15, stat: 'global-skills' },
  { id: 'planning', title: 'Planning Practice', xp: 50, coins: 10, stat: 'entrepreneurship' },
] as const);

export const SYSTEM_CORE_DAILY_QUEST_IDS = Object.freeze(SYSTEM_CORE_DAILY_QUESTS.map(quest => quest.id));

/** Canonical permanent Boss Quest catalogue. IDs are already persisted in user saves. */
export const SYSTEM_BOSS_QUESTS = Object.freeze([
  Object.freeze({
    id: 'boss-consistency', title: 'Consistency Trial',
    description: 'Complete three Daily Quests in the current day.',
    requirement: 'Complete at least 3 Daily Quests today.',
    xp: 250, coins: 60, condition: 'daily-quest-count', threshold: 3,
  }),
  Object.freeze({
    id: 'boss-awakening', title: 'Awakening Trial',
    description: 'Build your player Level through consistent progress.',
    requirement: 'Reach Player Level 3.',
    xp: 300, coins: 80, condition: 'player-level', threshold: 3,
  }),
  Object.freeze({
    id: 'boss-skill-ascendant', title: 'Skill Ascendant',
    description: 'Raise any one of your six core Stats to Level 3.',
    requirement: 'Reach Level 3 in any core Stat.',
    xp: 350, coins: 100, condition: 'best-stat-level', threshold: 3,
  }),
] as const);
