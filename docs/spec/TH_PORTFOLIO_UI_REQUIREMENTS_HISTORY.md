# TH Portfolio UI Requirements and Decision History

This is the DEV-29 design record from the original renewal brief through the layered v9 mock and the right-centre Wheel request. For current implementation requirements, read the [canonical Graph-centred UI specification](TH_PORTFOLIO_GRAPH_CENTERED_UI_SPEC.md). This record does not activate deployment or approve a provisional visual choice.

## Origin: explore the music, not a dashboard

The site is composer/arranger Talich Helfen's portfolio. Visitors enter with the music and discover works as points, like stars in a field. Preserve the existing works, coordinate meanings, artist identity, overview and audio controls. Work links/relationships and new data fields are not requirements. Do not invent dates more precise than the available year. Keep browsing exploratory, not a compulsory chronological tour.

The renewal also calls for a lighter experience and a distinct visual language: measure first paint, interaction, render and audio cost; fix Point overlap, hit testing, touch, hover/focus and filtering on real data. Three.js is a comparative experiment, not an adopted dependency. Preserve functional fallback and reduced motion. The previous trackpad-style mobile idea (horizontal relative cursor, vertical background navigation) is a test candidate only.

## How the design converged

| Stage | Retained outcome | What not to carry forward |
|---|---|---|
| Initial Graph redesign | One borderless, square, equal-scale Graph at viewport centre; thin axis cross and existing semantic coordinates. Stereo L/R is a subdued particle Lissajous, not one thick waveform. Drawers overlay, never shift or resize the Graph. | Equal-weight dashboards, framed plot, corner marks, fake telemetry and permanently open sidebars. |
| Browsing contract | TAG and YEAR narrow the set; Map retains original x/y; Archive lists and selects only remaining works. Year-as-travel motion is optional and may not change coordinates. | Re-layout on filtering, invented years/dates, compulsory relationships between works. |
| Closed-state v1–v3 | Agree a quiet closed state first; compact left audio trigger and visual rhythm based on shared 8px keylines (32px outer margin in the desktop reference). Align filter strip toward the left in the mock; final Sort placement is unresolved. | Flat XY dot grid and an isolated generic Wheel icon. |
| Wheel / drawers v4–v5 | A continuous arc grows from fading ticks. Labels are radial, perpendicular to the circle. Audio opens on the left; detail is separate from hover preview. | Lower-left placement, then the previously tested lower-right geometry for the current pass; a permanent WORK launcher is not in the current visual candidate. |
| Layered v6 | Back to front: ambient pseudo-particles, Lissajous, thin axes, Points, overlays. Static ambient particles are enough for mocks. Production uses subtle drift plus existing audio energy, with band weights as an optional tuning method. | Bringing decorative particles above Points or tying the visual field to new work metadata. |
| Dismissal v7 and readability v8 | Outside click, repeat trigger where applicable, Escape, and a subtle close control. Inside clicks do not dismiss. Audio/detail/filter blur and dim only the main field; standalone Wheel browsing leaves the Graph sharp. | Dimming the Graph just because the Archive is open. |
| v9 HTML experiment | Responsive centred stage; smaller actual Wheel hit areas; link archive item preview to Point, and explicit selection to detail; close detail independently so archive browsing can continue. TAG/YEAR drive the same sample set on both surfaces. | Sample work identities, static sample audio, six-slot pagination, visible rectangular Archive button, specific breakpoints: these are mock choices, not production contracts. The v9 Wheel geometry is still the earlier lower-right quarter arc. |
| Current right-centre preview | Align the circle centre to the right viewport edge and Graph horizontal axis, showing only its left half. Keep tick-only closed treatment, radial orientation and the v8 no-dim rule. | Do not use the v8/v9 corner geometry as the placement spec or render a solid half-disc. Exact radius, item density, and touch layout remain review choices. |

## Acceptance to carry forward

1. Compare closed, Wheel open, Audio open, and selected Work states. Measure that Graph centre and square geometry are unchanged; confirm visually that only the main field dims behind the three designated overlays.
2. Browse by pointer, keyboard and touch. Verify blank Wheel regions do not swallow Point interaction; read/operate controls at narrow widths. Test focus, explicit selection, repeat trigger, outside dismiss, Escape and Reduced Motion.
3. Check Tag, Year and a combined empty result, then clear filters. Ensure the existing work coordinates stay fixed, Archive and Map agree, and a filtered-out item cannot remain an actionable selection.
4. Verify real dataset, audio analyser and existing audio controls in the app. Browser geometry/interaction in a synthetic HTML mock is not app integration, physical touch-device coverage or performance validation.
5. Record design choices in this history and accepted behaviour in the canonical spec. Do not deploy from this design record.

## Repository references

- [Original reset](https://github.com/46slv/th_portfolio/commit/e176577) · [earlier visual baseline](../visual/TH_GRAPH_CENTERED_REFERENCE.html) (historical; not a placement authority)
- [Layered particle requirements](https://github.com/46slv/th_portfolio/commit/6be0a8d) · [dismissal](https://github.com/46slv/th_portfolio/commit/1ff0d0e) · [Archive readability exception](https://github.com/46slv/th_portfolio/commit/2e7121e)
- [Filter / Map / Archive responsibilities](https://github.com/46slv/th_portfolio/pull/9) (separate product-contract change)
