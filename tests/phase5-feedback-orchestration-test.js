'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const experience = read('js/features/experience.js');
const controller = read('js/legacy/app-controller.js');
const visual = read('js/modules/visual-effects.js');
const pkg = JSON.parse(read('package.json'));

assert.match(experience, /window\.addEventListener\(eventName/,
  'domain feedback must listen on the same target used by app-controller');
assert.doesNotMatch(experience, /document\.addEventListener\(eventName/,
  'window-dispatched domain events must not be attached to document');
assert.match(experience, /system-skill-level-up/,
  'skill level-up should have a sound mapping');
assert.match(experience, /DOMAIN_SOUND_PRIORITY = \{ quest: 1, reward: 2, streak: 3, levelup: 4, rank: 5 \}/,
  'multiple events from one committed action must collapse to the highest-priority sound');
assert.match(experience, /pendingDomainTimer = window\.setTimeout/,
  'domain feedback must be batched to avoid stacking same-turn sounds');
assert.match(experience, /NOTIFY_SOUND_GRACE_MS = 110/,
  'success-notification fallback must be deferred briefly for event arbitration');
assert.match(experience, /if \(pendingNotifyTimer\) window\.clearTimeout\(pendingNotifyTimer\)/,
  'domain events must cancel duplicate notification fallback');
assert.match(experience, /pendingNotifySound = null/,
  'event arbitration must clear stale fallback state');
assert.match(controller, /emitSystemVisualEvent\("system-quest-completed"/,
  'quest completion should emit a domain event after transaction commit');
assert.match(controller, /function flushSystemCelebrations\(/,
  'level/rank celebration queue should remain transaction-aware');
assert.match(visual, /MILESTONE_DEDUPE_WINDOW = 1800/,
  'visual milestone duplicate suppression must remain active');
assert.match(visual, /pendingMilestones\.length > MAX_MILESTONES/,
  'visual feedback queue must remain bounded');
assert.match(pkg.scripts['test:static'], /phase5-feedback-orchestration-test\.js/,
  'phase-five contract must be part of static test suite');
console.log('Phase 5 feedback orchestration contract passed: event target, duplicate audio arbitration, skill milestones, transaction-aware events, and bounded visual queue.');
