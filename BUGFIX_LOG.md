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
- Every map point ran a permanent floating animation.
- Reverb impulse and full audio decode were part of the startup path.
- The meter wrote layout-affecting width values every frame.
- 23 presentation-only Spreadsheet rows became empty work items.

### Fix

- Disabled neutral-rate Visual Shift updates and capped active updates at 15fps.
- Restored CSS-only hover and constant-time selected-node updates.
- Limited Wheel rendering to nearby entries and coalesced continuous input.
- Replaced per-work Tooltip instances with one lazy shared Tooltip.
- Removed permanent point animation.
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
