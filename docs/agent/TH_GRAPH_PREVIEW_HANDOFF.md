# DEV-29 — Graph-centered preview: implementation and handoff

Scope: `46slv/th_portfolio` (Talich Helfen), not SS Portfolio. This checkpoint modifies the comparison route `/archive-rebuild/` only. Do not deploy, merge, change the live route, or revive a conflicting older specification. Keep the previous `/archive-trial/` available as a control.

## Read first

1. [Current UI specification](../spec/TH_PORTFOLIO_GRAPH_CENTERED_UI_SPEC.md), especially §8.1/§8.2, and [decision history](../spec/TH_PORTFOLIO_UI_REQUIREMENTS_HISTORY.md). Newest explicit user decisions win. An old implementation is not evidence of a requirement.
2. [Original rebuild brief](TH_GRAPH_CENTERED_RESET.md). Confirm the branch and current writer before any edits.
3. Initial Astro / Cloudflare Pages and external spreadsheet ideas are historical only. The present preview uses the existing static Astro build and production work records; do not migrate hosting or publication data on that basis.

## What now works

- The viewport-centred square Graph is the primary composition; the Archive Wheel is a right-edge semicircle centered on the Graph's horizontal midline. Opening the Wheel alone does not dim or blur the Graph. Retain the old authoritative axis meanings, work IDs, tag/year filters and real metadata.
- Point hover or keyboard focus reveals one compact, interactive card near the Point. It does not mutate the persistent selection, rotate the Wheel or dim the Graph. Moving from the Point through the deliberate gap (including slowly or on a slight diagonal) retains the card without needing to race a timeout. Card hover and keyboard focus retain it; leaving the whole region dismisses it.
- The card uses real titles, artists, years, tags and links. Tab reaches an available link; Escape dismisses and restores focus when appropriate. Filtering dismisses the preview. An explicit desktop selection opens the separate details drawer, and touch on the Point uses that same drawer and real link. Moving the Wheel selection passively does not open that drawer.
- Point drift remains in normal motion and pauses for active preview. Reduced Motion remains supported. Background pseudo particles are currently visual/static; do not report them as audio-reactive yet.

## Run and verify

```sh
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 4279
# With an installed Chrome/Chromium and playwright-core:
node tests/point-preview.browser.cjs
```

Use `PLAYWRIGHT_CORE` if Playwright Core is installed outside this checkout, `CHROME_PATH` to select Chrome, and `TH_PREVIEW_URL` for a different local candidate port. No browser framework was added to the deploy dependencies. The regression uses real DOM mouse/touch/focus events and intercepts the outward-link destination locally to verify the URL without contacting that site. Windows Chrome: desktop 1440×900, emulated touch 390×844; 81 Node tests and the static build passed. Physical phone and Firefox/Safari are not claimed.

## Next checkpoint for Hermes Code → Pi

Work in a new, independently owned branch from this tested checkpoint, not this branch or the older Code review candidate. Make the **next integrated preview**, not a proposal. First keep the acceptance test green, then improve narrow viewport layout so Wheel labels do not steal Point hit targets, with proof at 320, 390 and desktop widths. Next adopt a restrained motion pass for the rear ambient layer using the existing audio-analysis path: small random drift plus audio energy, with optional band weighting only if supported by actual signals; keep Lissajous and Points distinct, respect reduced motion and unavailable audio, and do not add a second playback/analyser pipeline unnecessarily. Deliver an actual browser comparison. Do not invent asset data, implement unsettled questions as decisions, or change hosting. Preserve prior work, report touched files, test evidence, candidate SHA, preview, and unresolved choices (including any larger Relativistic Shift redesign). Use existing Mission Skills for briefing, orchestration and checkpointing. Do not copy the privately archived conversation logs into Git or prompts.
