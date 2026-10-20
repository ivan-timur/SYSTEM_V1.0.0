# SYSTEM v6.0.0 — Deep Intelligence Engine

## Major Logic & Intelligence Upgrade

This release introduces a dedicated **SYSTEM Intelligence Engine** — a deep, fully local analysis and adaptive planning core.

### What was added

#### 1. Intelligence Engine (`js/core/intelligence-engine.js`)
- Full history-aware analysis of the last 7 / 14 / 30 days
- Per-stat strength scoring (level + recent activity)
- **Momentum score** (0–100) combining volume, consistency and diversity
- **Fatigue / burnout detection** (high volume + low diversity, or sudden activity drop)
- Automatic identification of strongest / weakest / recommended focus skill
- Simple skill-synergy graph for smarter pairing recommendations
- Bilingual insights and next-best-action suggestions

#### 2. Deep Adaptive Local Planner
- New high-quality mission bank with clearer, more pedagogical tasks
- Difficulty and reward modulation based on current momentum
- Avoids recently completed titles
- Used automatically as the preferred fallback (and primary local planner) when the engine is present

#### 3. Integration
- Loaded first in the app boot sequence so legacy code can use it
- `buildLocalAdaptivePlan` now prefers the Intelligence Engine when available
- Lightweight insight card can surface on the AI / Status area

### What stayed the same
- All save data, XP curves, ranks, rewards, quests and existing features remain fully compatible
- No network dependency for the intelligence layer
- AI provider (Groq etc.) still works exactly as before; the engine improves the local fallback and analysis quality

### Version
- `VERSION` → `6.0.0`
- All synchronized version sources updated

### How to verify
1. Complete a few quests over different skill branches
2. Open the AI workspace and generate adaptive daily quests (with or without API key)
3. Observe the new intelligence-driven recommendations and the momentum-aware plan
