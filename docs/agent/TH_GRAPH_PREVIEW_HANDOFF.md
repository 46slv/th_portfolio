# DEV-29 — Graph-centered preview: implementation and handoff

> Start with the [Implementation Index](TH_IMPLEMENTATION_INDEX.md) for the current spec, verified preview, and open decisions.

Scope: `46slv/th_portfolio` (Talich Helfen), not SS Portfolio. This checkpoint modifies the comparison route `/archive-rebuild/` only. Do not deploy, merge, change the live route, or revive a conflicting older specification. Keep the previous `/archive-trial/` available as a control.

## Read first

1. [Current UI specification](../spec/TH_PORTFOLIO_GRAPH_CENTERED_UI_SPEC.md), especially §8.1/§8.2, and [decision history](../spec/TH_PORTFOLIO_UI_REQUIREMENTS_HISTORY.md). Newest explicit user decisions win. An old implementation is not evidence of a requirement.
2. [Original rebuild brief](TH_GRAPH_CENTERED_RESET.md). Confirm the branch and current writer before any edits.
3. Initial Astro / Cloudflare Pages and external spreadsheet ideas are historical only. The present preview uses the existing static Astro build and production work records; do not migrate hosting or publication data on that basis.

## What now works

- The viewport-centred square Graph is the primary composition; the Archive Wheel is a right-edge semicircle centered on the Graph's horizontal midline. Opening the Wheel alone does not dim or blur the Graph. Retain the old authoritative axis meanings, work IDs, tag/year filters and real metadata.
- Point hover or keyboard focus reveals one compact, interactive card near the Point. It does not mutate the persistent selection, rotate the Wheel or dim the Graph. Moving from the Point through the deliberate gap (including slowly or on a slight diagonal) retains the card without needing to race a timeout. Card hover and keyboard focus retain it; leaving the whole region dismisses it.
- The card uses real titles, artists, years, tags and links. Tab reaches an available link; Escape dismisses and restores focus when appropriate. Filtering dismisses the preview. An explicit desktop selection opens the separate details drawer, and touch on the Point uses that same drawer and real link. Moving the Wheel selection passively does not open that drawer.
- Point drift remains in normal motion and pauses for active preview. Reduced Motion remains supported.
- Ambient-motion candidate (local implementation slice, browser/Node checks passed; visual approval remains open): the existing 125 rear SVG circles retain their seeded positions/depth styling and now have small independent drift plus displacement from the existing actual overall analyser level. SVG transforms reuse the sole ~24fps meter loop and its single level read; no additional audio path, timer, RAF loop or dependency. Quiet drift starts only after entry, continues through Pause/failure, and drops stale energy immediately. Reduced Motion restores the static seeded field, including during playback. Hidden visibility suspends updates and resumes without integrating hidden time. Graph/Lissajous/Point/Wheel rendering is unchanged.

## Run and verify

```sh
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 4279
# With an installed Chrome/Chromium and playwright-core:
node tests/point-preview.browser.cjs
node tests/wheel-point.browser.cjs
node tests/wheel-motion.browser.cjs
node tests/ambient-motion.browser.cjs
node tests/overlap-access.browser.cjs
```

For the ambient slice replay use `CHROME_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe` and `TH_PREVIEW_URL=http://127.0.0.1:4287/archive-rebuild/` with a local server on port 4287. Keep `TEMP`, `TMP`, `TMPDIR`, npm cache and optional `TH_AMBIENT_EVIDENCE_DIR` under this checkout's `.local/` on E. The focused ambient regression records real playback success/failure explicitly, compares observed real-signal displacement against timestamp-matched quiet drift, checks Pause/failure and initial/live Reduced Motion, and samples shared callback/task cost. Visibility is a **scoped `document.hidden`/`visibilitychange` simulation**: native tab occlusion is not claimed. Timing includes existing scopes/Point animation and instrumentation, not a standalone ambient GPU benchmark. Optional before/after screenshots, real-signal motion trace and measured results remain untracked in `.local/ambient-evidence/`.

Use `PLAYWRIGHT_CORE` if Playwright Core is installed outside this checkout, `CHROME_PATH` to select Chrome, and `TH_PREVIEW_URL` for a different local candidate port. No browser framework was added to the deploy dependencies. The regression uses real DOM mouse/touch/focus events and intercepts the outward-link destination locally to verify the URL without contacting that site. Windows Chrome: desktop 1440×900, emulated touch 390×844; 84 Node tests and the static build passed for the ambient candidate. Physical phone and Firefox/Safari are not claimed.

## Compact Wheel overlap checkpoint

On 320×844 touch with Reduced Motion, a direct tap on the first compact Wheel label timed out because the next label intercepted it; on 390×844 the same tap opened the next work. Rectangular labels converged near the hub at `.48` radians per step. The compact-only spacing is now `.90` (at most three resting labels), without moving Point coordinates or altering the Wheel arc/track. `tests/overlap-access.browser.cjs` uses the real titles and URLs to check direct label taps/clicks, keyboard Point-card links, retained selection/focus, swipe/arrows and matching Tag/Year filters. With `CHROME_PATH` and `TH_PREVIEW_URL=http://127.0.0.1:4287/archive-rebuild/`, independent Chrome runs passed at 320/390 touch (normal and Reduced Motion) and 1440 desktop; `npm test` passed 84/84, `npm run build` passed, and Point-preview, nine-case Wheel and audio-reactive ambient regressions passed. The preview is local to the dedicated branch; no deploy or main integration. Direct Point-on-Point touch overlaps remain, while the Wheel provides access to those works; a physical phone and Safari/Firefox remain unverified. Untracked measurements and screenshots are under `.local/attempt/overlap-after/` and `.local/attempt/overlap-wheel-accepted/`, not part of Git.

## Next checkpoint for Hermes Code → Pi

The brief below preceded the compact Wheel and ambient checkpoints recorded above; do not repeat those slices as new work.

Work in a new, independently owned branch from this tested checkpoint, not this branch or the older Code review candidate. Make the **next integrated preview**, not a proposal. First keep the acceptance test green, then improve narrow viewport layout so Wheel labels do not steal Point hit targets, with proof at 320, 390 and desktop widths. Next adopt a restrained motion pass for the rear ambient layer using the existing audio-analysis path: small random drift plus audio energy, with optional band weighting only if supported by actual signals; keep Lissajous and Points distinct, respect reduced motion and unavailable audio, and do not add a second playback/analyser pipeline unnecessarily. Deliver an actual browser comparison. Do not invent asset data, implement unsettled questions as decisions, or change hosting. Preserve prior work, report touched files, test evidence, candidate SHA, preview, and unresolved choices (including any larger Relativistic Shift redesign). Use existing Mission Skills for briefing, orchestration and checkpointing. Do not copy the privately archived conversation logs into Git or prompts.
