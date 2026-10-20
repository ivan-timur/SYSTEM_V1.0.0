# SYSTEM v5.10.0 — Engineering Notes

## Skill Command Center

- Six skill branches retain twenty levels each (120 skills total). Rank/level gates remain data-driven and compatible with the existing stat identifiers.
- `skillTreeEnglish` is presentation copy only; the original skill catalogue remains the Dari source. `document.body.dataset.systemLanguage` chooses the display language without writing new player state.
- The summary counts unlocks by the same level/rank predicate used for the individual nodes, preventing the progress meter from drifting away from the visible state.
- Search and state filters only alter presentation; they never modify skill requirements, XP, ranks, or save data. All filters use delegated per-render listeners tied to the current tree DOM to avoid stale nodes.
- The rank text inserted into the description is normalized against the rank allowlist, while skill labels/descriptions and dynamic attribute values use HTML escaping.
- Open skill trees listen for `system-language-change` and redraw from the current display language. Progress remains in the original `system_v2_save`/`system_v2_progress` stores.

## Styles/build

- `css/apex-v510.css` is the final CSS source fragment. Edit this fragment rather than manually patching `css/system.css`, then run `npm run build:css`.
- `npm run build` synchronizes `VERSION`, module/package/manifest metadata and rebuilds the complete service-worker precache. The final output still uses a single runtime stylesheet with no `!important` declarations.
- Browser-level interaction specs are provided, but were not executed in the current environment because `@playwright/test` is not installed here.
