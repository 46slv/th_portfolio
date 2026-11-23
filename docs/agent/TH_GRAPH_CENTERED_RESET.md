# TH Portfolio — Agent Handoff / Graph-Centered Reset

This handoff supersedes the previous HUD + Spectral Field spike handoff.

## Read first

1. `docs/spec/TH_PORTFOLIO_GRAPH_CENTERED_UI_SPEC.md`
2. `docs/visual/TH_GRAPH_CENTERED_REFERENCE.html`
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
- Archive Wheel lower-left
- Archive open state shows only a 90° quarter arc
- drawers overlay and never move the Graph

Use real Works data and the current analyser path when integrating into the app.

The HTML reference uses synthetic L/R motion only as a visual stand-in. Replace that driver with the real analyser; do not reinterpret the layout.

## Legacy warnings

Do not reintroduce:

- boxed Map
- permanent right Audio HUD
- right-side Wheel
- half/full Wheel circle
- big circular Wheel panel
- multi-row filter button grid
- strong continuous Lissajous spaghetti line
- Map hover → persistent selection

## Done for the next pass

Return screenshots at the same desktop viewport for:

1. default / drawers closed
2. Audio drawer open
3. Archive Wheel open
4. Work detail drawer open

Before adding more HUD elements, compare those screenshots against `docs/visual/TH_GRAPH_CENTERED_REFERENCE.html`.

Do not merge or deploy production in this pass.
