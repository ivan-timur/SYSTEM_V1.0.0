# SYSTEM v6.2.0 — Status Declutter (⋯ More)

## Goal
Status page shows **only the six stats** by default. Secondary tools move behind a three-dots (⋯) button.

## Behaviour
- Main Status view: Player overview + 6 skill stats only.
- Bottom of Status: **⋯ More** button.
- Tapping More opens a bottom sheet (mobile) / centered panel (desktop) with:
  - **Progress Graph** — weekly activity, momentum, history
  - **Focus Timer** — 25-minute focus block
  - **SYSTEM Intelligence** — insights, focus recommendation, next action
- Choosing an option shows that tool inside the sheet (no longer cluttering the main page).

## Files
- `css/status-declutter-v62.css` — hides secondary panels, styles More button + sheet
- `js/status-more.js` — sheet open/close and tool display
- `index.html` — More button + sheet markup on Status page

## Compatibility
- Existing Grok Progress suite and Intelligence Engine are reused, not removed.
- Save data and other pages unchanged.
