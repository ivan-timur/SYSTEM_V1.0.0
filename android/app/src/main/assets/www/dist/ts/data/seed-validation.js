const isRecord = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const nonNegative = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
function result(value, issues) { return { valid: issues.length === 0, value, issues }; }
export function validateQuestCatalog(input) {
    const issues = [];
    if (!Array.isArray(input))
        return result(input, [{ path: '$', message: 'Quest catalog must be an array' }]);
    const ids = new Set();
    input.forEach((item, i) => {
        const path = `$[${i}]`;
        if (!isRecord(item)) {
            issues.push({ path, message: 'Quest must be an object' });
            return;
        }
        if (!nonEmpty(item.id))
            issues.push({ path: `${path}.id`, message: 'A non-empty id is required' });
        else if (ids.has(item.id))
            issues.push({ path: `${path}.id`, message: `Duplicate id: ${item.id}` });
        else
            ids.add(item.id);
        if (!nonEmpty(item.title))
            issues.push({ path: `${path}.title`, message: 'A non-empty title is required' });
        if (!nonNegative(item.xp))
            issues.push({ path: `${path}.xp`, message: 'XP must be finite and non-negative' });
        if (item.coins !== undefined && !nonNegative(item.coins))
            issues.push({ path: `${path}.coins`, message: 'Coins must be finite and non-negative' });
        if (item.stat !== undefined && item.stat !== null && !nonEmpty(item.stat))
            issues.push({ path: `${path}.stat`, message: 'Stat must be a non-empty id or null' });
    });
    return result(input, issues);
}
export function validateStatSeed(input) {
    const issues = [];
    if (!isRecord(input))
        return result(input, [{ path: '$', message: 'Stat seed must be an object' }]);
    if (!nonEmpty(input.id))
        issues.push({ path: '$.id', message: 'A non-empty id is required' });
    if (!nonEmpty(input.name))
        issues.push({ path: '$.name', message: 'A non-empty name is required' });
    if (!Array.isArray(input.skills) || input.skills.some(s => !nonEmpty(s)))
        issues.push({ path: '$.skills', message: 'Skills must be an array of non-empty strings' });
    for (const field of ['level', 'xp', 'xpRequired']) {
        if (!Number.isSafeInteger(input[field]) || input[field] < (field === 'level' ? 1 : 0))
            issues.push({ path: `$.${field}`, message: `${field} must be a valid non-negative integer${field === 'level' ? ' starting at 1' : ''}` });
    }
    if (nonEmpty(input.id) && Array.isArray(input.skills)) {
        const seen = new Set();
        input.skills.forEach((s, i) => { if (nonEmpty(s) && seen.has(s))
            issues.push({ path: `$.skills[${i}]`, message: `Duplicate skill: ${s}` });
        else if (nonEmpty(s))
            seen.add(s); });
    }
    return result(input, issues);
}
export function validateRewardCatalog(input) {
    const issues = [];
    if (!Array.isArray(input))
        return result(input, [{ path: '$', message: 'Reward catalog must be an array' }]);
    const ids = new Set();
    input.forEach((item, i) => {
        const path = `$[${i}]`;
        if (!isRecord(item)) {
            issues.push({ path, message: 'Reward must be an object' });
            return;
        }
        if (!nonEmpty(item.id))
            issues.push({ path: `${path}.id`, message: 'A non-empty id is required' });
        else if (ids.has(item.id))
            issues.push({ path: `${path}.id`, message: `Duplicate id: ${item.id}` });
        else
            ids.add(item.id);
        if (!nonEmpty(item.name))
            issues.push({ path: `${path}.name`, message: 'A non-empty name is required' });
        for (const field of ['xp', 'coins', 'cost', 'minLevel']) {
            if (item[field] !== undefined && (!Number.isSafeInteger(item[field]) || item[field] < 0))
                issues.push({ path: `${path}.${field}`, message: `${field} must be a non-negative integer` });
        }
    });
    return result(input, issues);
}
export function validateDefaultPlayerSeed(input) {
    const issues = [];
    if (!isRecord(input))
        return result(input, [{ path: '$', message: 'Player seed must be an object' }]);
    if (!Number.isSafeInteger(input.schemaVersion) || input.schemaVersion < 1)
        issues.push({ path: '$.schemaVersion', message: 'schemaVersion must be a positive integer' });
    if (!isRecord(input.player))
        issues.push({ path: '$.player', message: 'player object is required' });
    else {
        for (const field of ['level', 'xp', 'xpRequired', 'coins']) {
            const value = input.player[field];
            const minimum = field === 'level' ? 1 : 0;
            if (!Number.isSafeInteger(value) || value < minimum)
                issues.push({ path: `$.player.${field}`, message: `${field} must be a non-negative integer${field === 'level' ? ' starting at 1' : ''}` });
        }
        if (!['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'].includes(String(input.player.rank)))
            issues.push({ path: '$.player.rank', message: 'Unknown rank' });
    }
    return result(input, issues);
}
