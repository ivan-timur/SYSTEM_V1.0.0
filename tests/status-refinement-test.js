"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(ROOT, "css/refinements/status-refinement.css"), "utf8");
const buildConfig = fs.readFileSync(path.join(ROOT, "scripts/build-css.js"), "utf8");
const runtimeCss = fs.readFileSync(path.join(ROOT, "css/system.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

assert.ok(buildConfig.includes("css/refinements/status-refinement.css"), "Status refinement must be part of the generated CSS build.");
assert.ok(runtimeCss.includes("Source: css/refinements/status-refinement.css"), "Generated CSS must include the Status refinement source.");
assert.ok(source.includes("grid-template-columns: minmax(0, 1fr) auto;"), "Command Deck must not reserve an empty icon column.");
assert.ok(source.includes("min-height: 91px;"), "Phone skill cards must be tall enough for readable content.");
assert.ok(source.includes("grid-template-columns: repeat(2, minmax(0, 1fr));"), "Status skill cards must remain in a two-column mobile grid.");
assert.ok(source.includes("#system-app #status-page"), "The refinement must be scoped to the Status page.");
assert.ok(html.includes('id="status-more-btn"') && html.includes('data-status-command-title'), "Existing Command Deck control and labels must remain intact.");
assert.ok(html.includes('data-stat="entrepreneurship"') && html.includes('data-stat="unique-thinking"'), "Existing skill cards and their interaction hooks must remain intact.");

console.log("SYSTEM Status refinement checks passed: 7 checks.");
