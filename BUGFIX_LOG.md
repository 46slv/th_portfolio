# Bugfix Log

## 2026-07-13: GitHub Pages deployment stopped

### Symptoms

The public GitHub Pages URL returned `404 Site not found`. GitHub Actions deployments had also been failing.

### Cause

`.github/workflows/deploy.yml` contained unresolved Git merge conflict markers and duplicate, malformed job content. GitHub Actions could not run a valid deployment workflow.

### Fix

Removed the conflict markers and retained the known-good Astro build job: checkout, `withastro/action@v3`, and Node.js 22. The existing deployment job is unchanged.

### Prevention

Resolve Git merge conflicts before committing and ensure workflow files remain valid YAML before pushing.

### Verification

- `npm.cmd run build` completes successfully.
- GitHub Actions deployment is dispatched from `main` after this fix is pushed.
- The Pages URL is checked for HTTP 200 after deployment completes.

### Unverified

The production deployment remains unverified until GitHub Actions completes.

## 2026-07-16: Continuous rendering and interaction jank

### Symptoms

- The site felt heavy even when idle.
- Moving the pointer across map points caused visible hitching.
- Archive Wheel scrolling and dragging felt uneven.
- Starting the experience took a long time before audio metering became active.

### Cause

- Full-site CSS filters were rewritten every animation frame at the default playback rate.
- Map hover updated global selection and caused both map and Wheel synchronization.
- Wheel layout updated all 105 items and used repeated `indexOf()` searches.
- Every work rendered its own Tooltip and many hidden thumbnails loaded immediately.
- Every map point animated its outer node, where the same transform property also handled selection and filtering.
- Reverb impulse and full audio decode were part of the startup path.
- The meter wrote layout-affecting width values every frame.
- 23 presentation-only Spreadsheet rows became empty work items.

### Fix

- Disabled neutral-rate Visual Shift updates and capped active updates at 15fps.
- Restored CSS-only hover and constant-time selected-node updates.
- Limited Wheel rendering to nearby entries and coalesced continuous input.
- Replaced per-work Tooltip instances with one lazy shared Tooltip.
- Moved permanent point animation from the outer node to its small inner marker.
- Deferred Reverb impulse creation.
- Changed metering to 24fps `scaleX()` updates that stop when paused or hidden.
- Filtered rows without meaningful work content.

### Prevention

- Do not connect pointer hover directly to global work selection.
- Do not apply continuously changing filters to the full site at the neutral state.
- Keep Wheel work proportional to the visible item window, not total works.
- Keep Tooltip and thumbnail count independent from work count.
- Record DOM, image, HTML-size, and interaction expectations in `TEST_PLAN.md`.

### Verification

- `npm run build` succeeds.
- `git diff --check` succeeds.
- Generated HTML contains 82 works, 82 Wheel items, 1 Tooltip, 1 img, and no `null / null` item.
- Generated HTML decreased from approximately 284KB to 138KB.
- Browser accessibility snapshot exposes startup as a named button and work links with names.

### Unverified

- Long continuous Wheel drag/scroll in the Codex browser.
- Safari and mobile-device behavior.
- Production deployment and slow-network audio timing.

## 2026-07-16: Required map-point motion was removed

### Symptoms

Map points no longer moved continuously, so the map lost its intended living, unstable visual character.

### Cause

The performance pass treated constant point motion as optional decoration even though `TH Portfolio サイト仕様書.md` defines floating animation for every node.

### Fix

- Restored a six-second continuous floating animation for every valid point.
- Applied animation to the inner 16px marker instead of the outer coordinate and selection node.
- Distributed phases with deterministic per-point delays.
- Kept hover and focus pause behavior and the reduced-motion exception.

### Prevention

- Treat constant map-point floating as a non-removable visual requirement.
- Record mandatory behavior in the formal specification, README performance rules, decisions, worklog, and test plan.
- Optimize the animation target, amplitude, and timing before considering removal.

### Verification

- `npm run build` succeeds.
- Generated HTML contains `data-point-float` for every generated work node.
- `git diff --check` succeeds.

### Unverified

- Visual amplitude and timing on the production site.
- Long-session GPU and battery impact on lower-end mobile devices.

## 2026-07-16: Audio level display disappeared

### Symptoms

The audio display below the Reverb control remained empty even while the site audio was playing.

### Cause

`VolumeMeter.astro` retained Tailwind's `scale-x-0` utility while JavaScript wrote `transform: scaleX(...)`. Tailwind v4 applies scale through the individual CSS `scale` property, so the element stayed collapsed after the transform update.

### Fix

- Removed `scale-x-0` and set the initial inline transform to `scaleX(0)`.
- Added a real mixed-signal waveform to the Audio HUD.
- Added a post-gain stereo ChannelSplitter and raw-XY Lissajous scope to the Works Map.
- Shared the existing capped 24fps render loop across the meter and both Canvas scopes.

### Prevention

- Do not mix Tailwind individual transform utilities with JavaScript writes to the transform shorthand on the same element.
- Keep audio visualizers on one bounded rendering loop.
- Preserve raw-XY Lissajous rules in the formal specification and test plan.

### Verification

- `npm run build` succeeds.
- Generated HTML contains exactly one HUD waveform Canvas and one map Lissajous Canvas.
- The level bar no longer contains `scale-x-0`.

### Unverified

- Visual behavior with the production MP3 in Safari and on mobile hardware.
