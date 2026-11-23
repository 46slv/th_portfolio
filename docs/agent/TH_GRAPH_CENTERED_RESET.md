# TH Portfolio — Agent Handoff / Graph-Centered Reset

This handoff supersedes the previous HUD + Spectral Field spike handoff.

## Read first

1. `docs/spec/TH_PORTFOLIO_GRAPH_CENTERED_UI_SPEC.md`
2. `docs/spec/TH_PORTFOLIO_UI_REQUIREMENTS_HISTORY.md` (decision history and current preview scope)
3. `DECISIONS.md`
4. live implementation and affected tests

Branch carrying the handoff:
`handoff/graph-centered-reset-20261123`

## Authority rule

If an older spec conflicts with the canonical graph-centered spec, the older instruction is LEGACY.

Do not merge old layouts together.

## Task

Rebuild the current visual candidate from this graph-centered baseline.

Do not redesign the composition.

First match the reference structure:

- central square Graph at viewport center
- equal X/Y scale
- particle Lissajous in the Graph
- compact provisional Tag / Year at top
- Audio drawer on left
- Work detail drawer on right
- current preview: Archive Wheel right-centre, aligned with the Graph horizontal axis, opening into a thin inward half-arc
- opening only Archive Wheel does not dim/blur the Graph; no persistent WORK launcher
- drawers overlay and never move the Graph

Use real Works data and the current analyser path when integrating into the app.

Older HTML references use synthetic L/R motion and obsolete Wheel placement. Use them for visual tone only; real integration preserves the live analyser and work coordinates.

## Legacy warnings

Do not reintroduce:

- boxed Map
- permanent right Audio HUD
- lower-left Wheel; the lower-right quarter is a prior design reference
- full circle or filled/opaque half-circle panel
- multi-row filter button grid
- strong continuous Lissajous spaghetti line
- Map hover → persistent selection

## Done for the next pass

Return screenshots at the same desktop viewport for:

1. default / drawers closed
2. Audio drawer open
3. Archive Wheel open
4. Work detail drawer open

Before adding more HUD elements, compare those screenshots against the current specification; older reference HTML does not override geometry or dismissal rules.

Do not merge or deploy production in this pass.
