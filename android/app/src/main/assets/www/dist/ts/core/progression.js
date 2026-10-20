const VALID_RANKS = new Set(['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']);
const MAX_LEVEL_UPS_PER_EVENT = 1_000_000;
/** Shared XP-track transition used by Player and Stat progression in the TypeScript persistence layer. */
export function advanceXPTrack(current, amount, requiredForNextLevel, maxLevel = 1_000_000) {
    if (!current || typeof current !== 'object')
        throw new Error('XP track is required');
    if (typeof requiredForNextLevel !== 'function')
        throw new Error('XP threshold function is required');
    assertNonNegativeFinite(current.xp, 'Current track XP');
    if (!Number.isSafeInteger(current.level) || current.level < 1)
        throw new Error('Current track level must be a positive safe integer');
    assertNonNegativeFinite(amount, 'XP award');
    if (!Number.isSafeInteger(maxLevel) || maxLevel < current.level)
        throw new Error('XP track maximum level is invalid');
    if (!Number.isFinite(current.xpRequired) || current.xpRequired <= 0)
        throw new Error('Current XP threshold must be finite and positive');
    let level = current.level;
    let xp = current.xp + amount;
    let xpRequired = current.xpRequired;
    if (!Number.isFinite(xp))
        throw new Error('XP track total exceeds supported numeric range');
    let levelsGained = 0;
    while (xp >= xpRequired) {
        if (level >= maxLevel || levelsGained >= MAX_LEVEL_UPS_PER_EVENT) {
            throw new Error('XP track level-up guard reached; check XP threshold configuration');
        }
        xp -= xpRequired;
        level += 1;
        levelsGained += 1;
        // Do not ask for an unused threshold after reaching the configured cap.
        if (level < maxLevel) {
            const nextThreshold = requiredForNextLevel(level);
            if (!Number.isFinite(nextThreshold) || nextThreshold <= 0)
                throw new Error(`Invalid XP threshold for level ${level}`);
            xpRequired = nextThreshold;
        }
    }
    return { level, xp, xpRequired, levelsGained };
}
function assertNonNegativeFinite(value, label) {
    if (!Number.isFinite(value) || value < 0)
        throw new Error(`${label} must be a finite non-negative number`);
}
function validatePlayer(player) {
    if (!player || typeof player !== 'object')
        throw new Error('Player progress is required');
    assertNonNegativeFinite(player.xp, 'Player XP');
    assertNonNegativeFinite(player.coins, 'Player coins');
    if (!Number.isSafeInteger(player.level) || player.level < 1)
        throw new Error('Player level must be a positive safe integer');
    if (!VALID_RANKS.has(player.rank))
        throw new Error('Player rank is invalid');
    if (!player.skills || typeof player.skills !== 'object' || Array.isArray(player.skills))
        throw new Error('Player skills are invalid');
    if (!Array.isArray(player.completedQuestIds) || !Array.isArray(player.xpEvents) || !Array.isArray(player.achievements)) {
        throw new Error('Player progression collections are invalid');
    }
    // Validate collection identity before any transition is calculated. A duplicate
    // completion/achievement/event can otherwise hide corruption and make later
    // reward guards depend on which duplicate happens to be inspected first.
    const completedIds = new Set();
    for (const id of player.completedQuestIds) {
        if (typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 200) {
            throw new Error('Completed Quest IDs contain an invalid identity');
        }
        if (completedIds.has(id))
            throw new Error(`Duplicate completed Quest ID: ${id}`);
        completedIds.add(id);
    }
    const achievementIds = new Set();
    for (const id of player.achievements) {
        if (typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 200) {
            throw new Error('Achievement IDs contain an invalid identity');
        }
        if (achievementIds.has(id))
            throw new Error(`Duplicate Achievement ID: ${id}`);
        achievementIds.add(id);
    }
    const eventIds = new Set();
    for (const event of player.xpEvents) {
        if (!event || typeof event !== 'object'
            || typeof event.id !== 'string' || !event.id.trim() || event.id !== event.id.trim() || event.id.length > 280
            || typeof event.questId !== 'string' || !event.questId.trim() || event.questId !== event.questId.trim() || event.questId.length > 200
            || !Number.isFinite(event.amount) || event.amount < 0
            || typeof event.createdAt !== 'string' || !Number.isFinite(Date.parse(event.createdAt))
            || (event.skillId !== undefined && (typeof event.skillId !== 'string' || !event.skillId.trim() || event.skillId !== event.skillId.trim()))) {
            throw new Error('XP event ledger contains an invalid event');
        }
        if (eventIds.has(event.id))
            throw new Error(`Duplicate XP event ID: ${event.id}`);
        eventIds.add(event.id);
    }
    for (const [id, skill] of Object.entries(player.skills)) {
        if (!id || !skill || skill.id !== id || !Number.isSafeInteger(skill.level) || skill.level < 1)
            throw new Error(`Skill progress is invalid: ${id}`);
        assertNonNegativeFinite(skill.xp, `Skill XP (${id})`);
        if (skill.xpRequired !== undefined && (!Number.isFinite(skill.xpRequired) || skill.xpRequired <= 0)) {
            throw new Error(`Skill XP threshold is invalid: ${id}`);
        }
        if (skill.totalXp !== undefined)
            assertNonNegativeFinite(skill.totalXp, `Total Skill XP (${id})`);
        if (skill.lastActivityAt !== undefined && skill.lastActivityAt !== null && !Number.isFinite(Date.parse(skill.lastActivityAt))) {
            throw new Error(`Skill activity timestamp is invalid: ${id}`);
        }
    }
}
/** Apply completion as one deterministic domain transition. Persist the result atomically. */
export function completeQuest(player, quest, rules, now = new Date().toISOString()) {
    validatePlayer(player);
    if (!quest || typeof quest !== 'object' || typeof quest.id !== 'string' || !quest.id.trim() || quest.id !== quest.id.trim() || quest.id.length > 200)
        throw new Error('Quest ID is required and must be a trimmed string of at most 200 characters');
    if (typeof quest.title !== 'string' || !quest.title.trim())
        throw new Error('Quest title is required');
    if (!['available', 'in-progress', 'completed'].includes(quest.status))
        throw new Error('Quest status is invalid');
    assertNonNegativeFinite(quest.xpReward, 'Quest XP reward');
    assertNonNegativeFinite(quest.coinReward ?? 0, 'Quest coin reward');
    if (quest.skillId !== undefined && (typeof quest.skillId !== 'string' || !quest.skillId.trim()))
        throw new Error('Quest skill ID is invalid');
    if (quest.skillRewards !== undefined && !Array.isArray(quest.skillRewards))
        throw new Error('Quest Skill rewards are invalid');
    if (!Number.isFinite(Date.parse(now)))
        throw new Error('Completion timestamp is invalid');
    if (typeof rules?.xpForNextLevel !== 'function' || typeof rules?.rankForLevel !== 'function')
        throw new Error('Progression rules are incomplete');
    if (player.completedQuestIds.includes(quest.id) || quest.status === 'completed') {
        return { player, quest, leveledUp: [], newlyUnlockedAchievements: [], alreadyCompleted: true };
    }
    // Work entirely on copies: throwing during validation/rule evaluation must not mutate the saved aggregate.
    const next = {
        ...player,
        skills: Object.fromEntries(Object.entries(player.skills).map(([id, skill]) => [id, { ...skill }])),
        completedQuestIds: [...player.completedQuestIds],
        xpEvents: [...player.xpEvents],
        achievements: [...player.achievements],
    };
    next.coins += quest.coinReward ?? 0;
    if (!Number.isFinite(next.coins))
        throw new Error('Progression reward exceeds supported numeric range');
    const initialPlayerThreshold = rules.xpForNextLevel(next.level);
    if (!Number.isFinite(initialPlayerThreshold) || initialPlayerThreshold <= 0)
        throw new Error(`Invalid XP threshold for level ${next.level}`);
    const playerTrack = advanceXPTrack({ level: next.level, xp: next.xp, xpRequired: initialPlayerThreshold }, quest.xpReward, rules.xpForNextLevel, Number.MAX_SAFE_INTEGER);
    next.xp = playerTrack.xp;
    next.level = playerTrack.level;
    const leveledUp = Array.from({ length: playerTrack.levelsGained }, (_, index) => player.level + index + 1);
    const requestedSkillRewards = quest.skillRewards ?? (quest.skillId ? [{ skillId: quest.skillId, xpReward: quest.xpReward }] : []);
    const seenRewardSkillIds = new Set();
    for (const reward of requestedSkillRewards) {
        if (!reward || typeof reward.skillId !== 'string' || !reward.skillId.trim() || reward.skillId !== reward.skillId.trim()) {
            throw new Error('Quest Skill reward has an invalid Skill ID');
        }
        if (seenRewardSkillIds.has(reward.skillId))
            throw new Error(`Quest contains duplicate Skill reward: ${reward.skillId}`);
        seenRewardSkillIds.add(reward.skillId);
        assertNonNegativeFinite(reward.xpReward, `Skill XP reward (${reward.skillId})`);
        const old = next.skills[reward.skillId] ?? { id: reward.skillId, xp: 0, level: 1 };
        if (rules.xpForNextSkillLevel) {
            const initialSkillThreshold = old.xpRequired ?? rules.xpForNextSkillLevel(old.level);
            if (!Number.isFinite(initialSkillThreshold) || initialSkillThreshold <= 0) {
                throw new Error(`Invalid Skill XP threshold for ${reward.skillId} at level ${old.level}`);
            }
            const skillTrack = advanceXPTrack({ level: old.level, xp: old.xp, xpRequired: initialSkillThreshold }, reward.xpReward, rules.xpForNextSkillLevel, 1_000_000);
            const totalXp = Math.min(1_000_000_000_000, (old.totalXp ?? old.xp) + reward.xpReward);
            if (!Number.isFinite(totalXp))
                throw new Error('Total Skill XP exceeds supported numeric range');
            next.skills[reward.skillId] = {
                ...old,
                id: reward.skillId,
                level: skillTrack.level,
                xp: skillTrack.xp,
                xpRequired: skillTrack.xpRequired,
                totalXp,
                lastActivityAt: now,
            };
        }
        else {
            const skillXP = old.xp + reward.xpReward;
            if (!Number.isFinite(skillXP))
                throw new Error('Skill XP exceeds supported numeric range');
            next.skills[reward.skillId] = { ...old, xp: skillXP };
        }
    }
    const newRank = rules.rankForLevel(next.level);
    if (!VALID_RANKS.has(newRank))
        throw new Error(`Invalid rank for level ${next.level}`);
    next.rank = newRank;
    next.completedQuestIds.push(quest.id);
    const eventId = `quest:${quest.id}`;
    if (next.xpEvents.some((event) => event.id === eventId))
        throw new Error(`XP event already exists without matching completion record: ${quest.id}`);
    next.xpEvents.push({ id: eventId, questId: quest.id, amount: quest.xpReward, skillId: quest.skillId, createdAt: now });
    const newlyUnlockedAchievements = [];
    const seenRuleIds = new Set();
    for (const rule of rules.achievementRules ?? []) {
        if (!rule || typeof rule.id !== 'string' || !rule.id.trim() || typeof rule.predicate !== 'function')
            throw new Error('Achievement rule is invalid');
        if (seenRuleIds.has(rule.id))
            throw new Error(`Duplicate achievement rule: ${rule.id}`);
        seenRuleIds.add(rule.id);
        if (!next.achievements.includes(rule.id) && rule.predicate(next)) {
            next.achievements.push(rule.id);
            newlyUnlockedAchievements.push(rule.id);
        }
    }
    const completed = { ...quest, status: 'completed', completedAt: now };
    return { player: next, quest: completed, leveledUp, newlyUnlockedAchievements, alreadyCompleted: false };
}
