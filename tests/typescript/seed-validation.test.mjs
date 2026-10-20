import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateQuestCatalog, validateStatSeed, validateRewardCatalog, validateDefaultPlayerSeed } from '../../dist/ts/data/seed-validation.js';
const root = new URL('../../data/', import.meta.url).pathname;
const json = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
for (const file of readdirSync(join(root, 'quests')).filter(f => f.endsWith('.json'))) {
  const checked = validateQuestCatalog(json(`quests/${file}`));
  assert.equal(checked.valid, true, `${file}: ${JSON.stringify(checked.issues)}`);
}
for (const file of readdirSync(join(root, 'stats')).filter(f => f.endsWith('.json'))) {
  const checked = validateStatSeed(json(`stats/${file}`));
  assert.equal(checked.valid, true, `${file}: ${JSON.stringify(checked.issues)}`);
}
for (const file of readdirSync(join(root, 'rewards')).filter(f => f.endsWith('.json'))) {
  const checked = validateRewardCatalog(json(`rewards/${file}`));
  assert.equal(checked.valid, true, `${file}: ${JSON.stringify(checked.issues)}`);
}
assert.equal(validateDefaultPlayerSeed(json('player/default-player.json')).valid, true);
assert.equal(validateQuestCatalog([{ id: 'x', title: 'ok', xp: -1 }]).valid, false);
assert.equal(validateQuestCatalog([{ id: 'x', title: 'ok', xp: 1 }, { id: 'x', title: 'dup', xp: 1 }]).valid, false);
assert.equal(validateStatSeed({ id: 'math', name: 'Math', skills: ['A', 'A'], level: 1, xp: 0, xpRequired: 100 }).valid, false);
assert.equal(validateRewardCatalog([{ id: 'r', name: 'Reward', xp: -2 }]).valid, false);
assert.equal(validateDefaultPlayerSeed({ schemaVersion: 1, player: { level: 0, xp: 0, xpRequired: 100, coins: 0, rank: 'E' } }).valid, false);
console.log('Seed validation tests passed: quest/stat/reward/player catalogs + invalid fixtures');
