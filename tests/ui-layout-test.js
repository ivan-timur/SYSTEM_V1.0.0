"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }

const html = read("index.html");
const legacy = read("js/legacy/app-controller.js");
const grok = read("js/features/grok-suite.js");
const status = read("js/features/status-more.js");
const i18n = read("js/features/i18n.js");
const buildCss = read("scripts/build-css.js");
const css = read("css/system.css");
const dockCss = read("css/refinements/command-deck.css");
const mobileNavCss = read("css/refinements/mobile-nav-integrity.css");
const legacyMobileCss = read("css/refinements/mobile.css");

check(!html.includes('class="ai-composer-tools"'), "AI tools toolbar must be removed from the AI composer.");
check(!html.includes('data-ai-prompt="Study Analyzer"') && !html.includes('data-ai-prompt="Code Helper"') && !html.includes('data-ai-prompt="Math Solver"') && !html.includes('data-ai-prompt="Idea Generator"') && !html.includes('data-ai-prompt="Goal Assistant"'), "AI Tools prompt shortcuts must be removed from the page markup.");
check(!html.includes('<aside class="ai-tools-panel">'), "The tall AI Tools sidebar must be removed from the page markup.");
check(!html.includes('data-open-study'), "Study Desk shortcut must be removed from the AI composer dock.");
check(!html.includes('id="grok-study-suite"'), "Study Desk must not be statically rendered as a tall block at the bottom of AI.");
check(grok.includes("modal.id = 'grok-study-modal'") && grok.includes("modal.hidden = true"), "Study Desk must be mounted into a hidden modal on demand.");
check(grok.includes("modal.setAttribute('aria-modal'") || grok.includes("section.setAttribute('aria-modal', 'true')"), "Study Desk modal must declare accessible modal semantics.");
check(grok.includes("event.key === 'Escape'") && grok.includes('lastStudyTrigger.focus()'), "Study Desk must support Escape dismissal and return focus to its launcher.");
check(grok.includes("event.key !== 'Tab'") && grok.includes("document.documentElement.dataset.grokStudyModalBound"), "Study Desk must install one keyboard focus-trap handler.");
check(legacy.includes('button.getAttribute("data-ai-prompt")'), "AI prompt handler remains available for the main suggested prompts.");
const commandTrigger = html.match(/<button[^>]*id="status-more-btn"[\s\S]*?<\/button>/);
check(Boolean(commandTrigger) && commandTrigger[0].includes('status-command-btn') && !commandTrigger[0].includes('<svg') && !commandTrigger[0].includes('status-command-icon'), "The Status Command Deck launcher must remain icon-free and accessible.");
const commandActions = [...html.matchAll(/<button[^>]*data-status-tool="[^"]+"[\s\S]*?<\/button>/g)].map((match) => match[0]);
check(commandActions.length === 7 && commandActions.every((action) => action.includes('status-more-action-index') && action.includes('status-more-action-copy') && !action.includes('status-more-action-icon')), "All seven Command Deck actions must use numbered text cards without pictographic icons.");
check(status.includes('function updateStatusCommandText') && status.includes('function openSheet()') && status.includes('aria-pressed'), "Status Command Deck must retain language-aware labels and active-tool semantics.");
check(status.includes("event.key === 'Escape'") && status.includes("event.key !== 'Tab'"), "Status Command Deck must support Escape and focus trapping.");
check(buildCss.includes("'css/refinements/command-deck.css'"), "New layout source must be included in the generated CSS build.");
check(css.includes('Source: css/refinements/command-deck.css') && css.includes('.status-command-btn'), "Generated CSS must include Status Command Deck styling.");
check(dockCss.includes('form.chat-input.ai-composer .ai-composer-tools > button.ai-tool-chip') && dockCss.includes('width: auto;'), "AI shortcuts must override legacy fixed-width chat buttons on desktop.");
check(dockCss.includes('@media (max-width: 600px)') && dockCss.includes('.ai-tool-label {\n    display: none;'), "Mobile AI shortcuts must switch to a compact icon-only dock without overlapping labels.");
check(css.includes('flex: 0 0 34px;') && css.includes('.ai-tool-label {\n    display: none;'), "Generated runtime CSS must preserve the compact mobile AI shortcut layout.");
check(mobileNavCss.includes('min-width: 0;') && mobileNavCss.includes('max-width: 100vw;') && mobileNavCss.includes('height: auto;'), "Canonical mobile navigation must reset desktop sidebar sizing constraints.");
check(mobileNavCss.includes('grid-template-columns: repeat(5, minmax(0, 1fr));') && mobileNavCss.includes('transform: none;'), "Mobile navigation must retain five equal-width destinations and prevent icon transform drift.");
check(!legacyMobileCss.includes('PHASE 27 — MOBILE NAVIGATION WIDTH + VISIBILITY HARD FIX'), "Mobile navigation sizing must have one canonical source, not competing duplicate overrides.");
check(css.includes('Source: css/refinements/mobile-nav-integrity.css') && css.includes('max-width: 100vw;'), "Generated CSS must include the complete mobile navigation sizing contract.");
for (const phrase of ["Study Analyzer", "Study Desk", "Goal Assistant", "Command Deck", "Open Status Command Deck", "Status Tools"]) {
  check(i18n.includes(`"${phrase}"`), `Bilingual dictionary must include ${phrase}.`);
}

console.log(`SYSTEM UI layout regression checks passed: ${checks} checks.`);
