# SYSTEM v5.11.0 — Mobile Premium UI Upgrade

## Focus
Excellent phone-first design and visual polish for mobile devices.

## What changed

### New CSS layer
- Added `css/mobile-premium-v511.css` as the final mobile source fragment.
- Integrated into the official CSS build pipeline (`scripts/build-css.js`).

### Bottom Navigation
- Transformed the sidebar into a modern floating-style bottom bar on screens ≤ 850px.
- Large, comfortable touch targets (minimum 48px).
- Active state with soft glow and scale feedback.
- Full support for `safe-area-inset-bottom` (iPhone notch / home indicator).

### Layout & Spacing
- Improved main content padding and bottom clearance so content never sits under the nav.
- Refined player HUD with better depth and rounded corners.
- Cards, panels, skill nodes and settings rows receive consistent premium radius and subtle glass-like depth.

### Typography
- Better responsive scaling for headings and body text.
- Prevented overly small labels on narrow screens.

### Interaction
- Smooth press feedback (`scale(0.96)`) on buttons.
- Subtle page entrance animation (`mobileFadeUp`).
- Optimized landscape mobile layout (horizontal nav items).

### Compatibility
- Purely visual / layout layer.
- Does not modify save data, skill logic, quests, rewards or AI features.
- Works with existing themes (Cosmic, Aurora, Royal, etc.).

## How to use
1. Open `index.html` (or serve the folder).
2. Resize the browser or open on a real phone.
3. The new bottom navigation and refined cards appear automatically under 850px width.

## Version
- `VERSION` → `5.11.0`
- `js/modules/version.js` and `package.json` synchronized.
