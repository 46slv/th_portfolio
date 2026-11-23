# TH Portfolio — Graph-Centered UI Specification vNext

Status: **CURRENT CANONICAL UI / LAYOUT SPEC**
Date: 2026-11-23
Scope: desktop visual hierarchy, graph geometry, drawers/overlays, Audio UI, filters, Archive Wheel, work-detail presentation, audio visualization.

## 0. Authority and legacy policy

This document is the current source of truth for the TH Portfolio **UI / layout / visual interaction model**.

Authority order:

1. Current explicit user instruction
2. This specification
3. Newer repo Decisions that do not conflict with this specification
4. Live implementation / tests for engineering facts
5. Older specs and historical implementation

If any older document conflicts with this file, the conflicting part is **LEGACY** and must not constrain the current implementation.

In particular, conflicting layout/visual instructions in these documents are legacy:

- `TH Portfolio サイト仕様書.md`
- `Archive Wheel × Works Map 連動機能 仕様書.md`
- historical screenshots / previous visual spikes
- previous left-side Archive Wheel placement
- previous full/half-circle Archive Wheel panel treatments
- previous persistent right-side Audio HUD layout
- previous boxed Works Map layout
- previous near-point Card layout when it conflicts with the drawer model below

Non-conflicting technical facts may still be reused.

---

# 1. Product model

The site is centered on a single observation field.

**The central Graph is the primary visual object of the site.**

Everything else exists to control, filter, browse, or inspect that Graph.

Primary mental model:

```text
                 [ Tag / Year overlay ]
                         ↓

        [ Audio ]   [ CENTRAL GRAPH ]   [ Work / Scope ]
         drawer          PRIMARY             drawer
                           │
                           │
                  [ Archive Wheel ]
                    lower-right overlay
```

The UI must not read as a dashboard with several equal panels.

The Graph is the dominant figure. Drawers are secondary overlays.

---

# 2. State labels

Requirements in this document use three labels.

## CONFIRMED

A product requirement fixed by current user direction. Do not change without a new user decision.

## PROVISIONAL

A current implementation candidate for the next visual pass. Keep it easy to move or remove.

## LEGACY

An older rule superseded by this document.

---

# 3. Central Graph — CONFIRMED

## 3.1 Role

The Graph is the visual and interaction center of the site.

It combines:

- existing work coordinate space
- work points
- stereo Lissajous-derived audio visualization
- selected / preview state
- minimal axis calibration

Do not treat the Graph as a background decoration.

Do not place a large rectangular panel around it.

## 3.2 Position

Desktop first-pass reference viewport:

```text
1600 × 1000
```

The Graph center must remain at the viewport center:

```css
left: 50vw;
top: 50vh;
transform: translate(-50%, -50%);
```

**The vertical center of the Graph must always equal the vertical center of the viewport.**

For the current desktop pass, the Graph is also horizontally centered.

Drawers must overlay the Graph rather than push it away from center.

## 3.3 Geometry

The Graph coordinate field must use equal X/Y visual scale.

**Width and height are always equal.**

First-pass desktop rule:

```css
--graph-size: min(70vh, 46vw);
width: var(--graph-size);
height: var(--graph-size);
aspect-ratio: 1 / 1;
```

At 1600×1000 this produces approximately a 700×700 coordinate field.

Do not stretch the Graph horizontally or vertically.

A unit in X and the same unit in Y must occupy the same screen distance.

## 3.4 Existing semantic axes

Preserve the current work-coordinate semantics unless explicitly changed later:

```text
           Maniac
              ↑
              │
Electro ←─────┼─────→ Acoustic
              │
              ↓
           Popular
```

Existing Work `x / y` remain the positioning source.

Filtering does not re-layout work coordinates.

Axis lines must be low contrast and must not form a visible box.

Do not add corner brackets / corner marks around the Graph. The coordinate field is defined only by the axes, labels, Work Points, and audio field.

## 3.5 Work Points

Preserve the existing `+` work marker family.

- Work Point must be visually distinguishable from audio particles.
- Work Point is an interaction target.
- Audio particles are never interaction targets.
- Existing slow point floating may remain.
- Hover/focus may temporarily stop or stabilize the local marker.
- Filtered-out points may fade/depth-recede but do not move to a new x/y.

---

# 4. Lissajous particle field — CONFIRMED

## 4.1 Source

Use the existing real stereo analyser path.

Current engineering source:

- Left channel → X
- Right channel → Y
- Y rendered inverted for screen coordinates
- no 45° phase-scope rotation

Use live analyser values. Do not invent audio telemetry.

## 4.2 Visual representation

The central audio visualization is a **particle-based Lissajous field**.

Do not render the Lissajous as one strong continuous spaghetti line.

Preferred first-pass rendering:

- sample points are rendered as particles / dots
- particles occupy the same square coordinate system as the Graph
- low-opacity afterimage / short trail may be used
- the resulting shape should read as a coherent Lissajous distribution, not random ambient dust
- the particle field is visually weaker than active Work Points
- selected Work Points remain readable over the particle field

First-pass rendering target:

- max source points per frame: existing limit up to 512
- update cadence: reuse the existing visual update path, max approximately 24fps
- particle diameter: approximately 0.8–1.6 CSS px
- base opacity: approximately 0.05–0.22
- brightest particle/trail accents must remain below selected Work Point contrast
- no pointer events

These numeric values are visual-pass constants, not permanent product API.

## 4.3 Trail behavior

PROVISIONAL:

Use a short fading persistence instead of fully clearing every frame, so the Lissajous feels particulate and spatial.

The trail must not accumulate into an opaque scribble.

If the output begins to resemble a line bundle, reduce persistence or point opacity.

## 4.4 Pause / unavailable audio

When audio is paused or unavailable:

- Graph geometry remains
- Work Points remain
- Lissajous particles may fade to zero
- UI must not collapse

---

# 5. Overlay / Drawer system — CONFIRMED

All major controls outside the central Graph are overlays.

They must **not participate in layout sizing of the Graph**.

Opening a drawer must not move, resize, or re-center the Graph.

Use fixed/absolute overlay layers with explicit z-order.

Suggested layer order:

```text
0  base background
10 Graph axes / Lissajous field
20 Work Points
30 preview / selection indicators
50 drawer surfaces
60 Archive Wheel
70 transient tooltip / feedback
```

Drawers should feel like instrument interfaces, not application sidebars.

No large permanent sidebar.

No full-height opaque column unless a future user decision explicitly approves it.

---

# 6. Audio controls — CONFIRMED

## 6.1 Placement

Audio controls belong on the **left side**.

They are stored in a left overlay drawer.

Closed state:

- compact edge trigger / HUD terminal
- does not occupy layout width
- current audio state may be hinted with a minimal indicator

Open state:

- overlay drawer extends from the left
- Graph remains centered and unchanged underneath
- drawer may partially overlap the Graph

## 6.2 Existing controls to preserve

Use the current real controls:

- Play / Pause
- Master Gain
- Relativistic Shift
- Distortion / Entropy
- Delay / Echoes
- Reverb / Space
- actual level meter
- shift state

## 6.3 Visual hierarchy

CONFIRMED hierarchy:

Primary:
- Play / Pause
- Master Gain
- Relativistic Shift

Secondary:
- Distortion
- Delay
- Reverb

Monitoring:
- actual output level
- shift state
- optional compact waveform/scope

Do not use a large high-contrast rectangular Play/Pause button as the visual center of the drawer.

Controls should use thin scales, ticks, numeric/state readouts, and compact interaction geometry.

---

# 7. Sort / Filter — CONFIRMED behavior, PROVISIONAL placement

## 7.1 Behavior — CONFIRMED

Filtering remains split into two independent concepts:

- Tag
- Year

Tag and Year must not be collapsed into one generic Sort control.

Tag filtering:
- ordinary work-set filtering
- no implied time motion

Year filtering:
- work-set filtering
- may later retain temporal-navigation motion
- does not change work x/y

Archive Wheel must only browse works remaining after filtering.

## 7.2 Placement — PROVISIONAL

The final location is not yet decided.

The user is explicitly considering:

1. a thin top overlay
2. distribution into left/right drawers around the central Graph
3. using side regions for other audio scopes / HUD information

For the next HTML visual pass only:

**Use a compact top overlay as the provisional placement.**

Implement Tag and Year as two visually separate modules/triggers.

Do not render a multi-row button grid.

Keep the implementation movable so later review can relocate Tag/Year without changing filtering logic.

---

# 8. Work detail / selected information — CONFIRMED drawer model

The old near-point Card is no longer the required persistent detail surface.

When work detail is needed, use an overlay/drawer model.

CONFIRMED:

- hover/focus = temporary preview
- persistent selection remains separate
- do not flood the Graph with title/year/tag labels
- only minimal local selection marks may appear around a Work Point

PROVISIONAL current placement:

- work-detail drawer on the **right side**
- compact closed trigger
- opens over the Graph without moving it
- contains thumbnail / artist / year / title / tags / access action using existing data

A small micro-label near the Point is allowed for preview, but the full detail surface belongs in the drawer.

This section supersedes older requirements that make a near-point Card the only required detail surface.

---

# 9. Secondary waveform / HUD information — PROVISIONAL

The user is considering additional waveform/scope displays to increase HUD information density.

This is not yet a required feature.

Reserve the right-side overlay system so a future small scope can coexist with the Work detail drawer.

For the next visual pass:

- do not add several independent waveforms
- optionally include one collapsed `SCOPE` trigger or one compact monitoring strip
- do not compete with the central Lissajous particle field

The central Graph remains the primary audio visualization.

---

# 10. Archive Wheel — CONFIRMED

## 10.1 Placement

Archive Wheel is fixed to the **lower-right**.

The previous lower-left placement is LEGACY. Older right-side implementations that used a large panel/disc/half-circle are also LEGACY; only the lower-right quarter-arc geometry below is current.

## 10.2 Geometry

The visible Wheel must be only a **90-degree arc / quarter circle**.

Do not show a complete circle.

Do not show a half-circle occupying the screen.

Do not render a circular panel/disc.

The open Wheel is a thin quarter-circle overlay entering from the lower-right corner. The visible quadrant is the upper-left quadrant of an off-screen/edge circle center.

First-pass geometry at 1600×1000:

- circle center is outside or very near the lower-right viewport corner
- only one quadrant of the circle is visible
- radius approximately 280–360 CSS px
- visible arc approximately 90°
- arc and ticks are thin and low contrast

Exact radius may be optically tuned, but visible arc must remain quarter-circle-like.

## 10.3 Open / closed state

Closed:
- only a compact lower-right Wheel/HUD trigger remains

Open:
- the 90° arc expands/reveals from the same origin
- no background panel
- Graph does not move
- Wheel overlays the Graph

## 10.4 Work labels

Wheel label orientation is **radial**.

For a label positioned on the circle at polar angle `θ`:

- label baseline follows the radius vector
- implementation rotation is `θ` (or `θ + 180°` only when needed to keep text upright)
- do **not** use tangent rotation `θ + 90°`
- visually, each title stands perpendicular to the circle circumference, matching the approved reference
- selected/focus position is visually stable
- work labels move along the arc as the user browses
- selected and nearest neighbors have the highest contrast
- distant labels fade strongly

## 10.5 Input contract

Preserve the quality of current input behavior:

- mouse wheel
- drag
- touch/swipe where applicable
- keyboard navigation

Only the active Wheel overlay region should capture browsing input.

Filtering changes the browsable work set but does not relocate Graph points.

---

# 11. Persistent identity and utilities — CONFIRMED minimal

Allowed persistent elements outside drawers:

- Talich Helfen identity
- Composer / Arranger label
- minimal Contact action
- minimal Tag/Year trigger strip during the provisional top-filter pass

These must remain visually secondary to the central Graph.

---

# 12. Visual language — CONFIRMED

The visual target is not a generic sci-fi dashboard.

Target character:

**quiet technical observation instrument**

Use:

- near-black neutral base
- silver / cool neutral text and lines
- restrained cyan for active/selected state
- thin strokes
- major/minor ticks
- calibrated geometry
- precise micro typography
- selective density
- large areas of visual quiet around the Graph

Avoid:

- large permanent panels
- full-height sidebars
- large button grids
- rounded dashboard cards
- thick neon borders
- excessive glow
- fake scientific values
- decorative telemetry without real meaning
- central spaghetti line visualizer
- UI elements that visually outweigh the Graph

---

# 13. Desktop-first reference composition — CURRENT FIRST PASS

For the next HTML pass at 1600×1000:

```text
┌───────────────────────────────────────────────────────┐
│ identity        [ TAG ]   [ YEAR ]          contact   │
│                                                       │
│          ┌─────────────────────────────┐              │
│ AUDIO ◀  │                             │   WORK /     │
│ drawer   │        CENTRAL GRAPH        │   SCOPE ▶    │
│ overlay  │        1:1 square           │   drawer     │
│          │    Lissajous particles      │   overlay    │
│          │       + Work Points         │              │
│          │                             │              │
│          └─────────────────────────────┘              │
│                                                       │
│                                  Archive 90° Wheel ◕ │
└───────────────────────────────────────────────────────┘
```

The drawn rectangle above is only diagrammatic. **Do not draw an actual border around the Graph.**

Default screenshot for review should show:

- central square Graph clearly dominant
- Audio drawer closed
- Work/Scope drawer closed
- Tag/Year compact at top
- Wheel either closed or minimally visible

Additional review screenshot:

- Audio drawer open
- Wheel open quarter arc
- work selected / right detail drawer open

---

# 14. Legacy conflict table

The following older rules are explicitly superseded.

| Older rule | Current rule |
|---|---|
| Works Map inside a bordered square/panel | Graph has no visible container border |
| Audio HUD permanently on the right | Audio controls live in left overlay drawer |
| Archive Wheel on lower-left | Archive Wheel is lower-right |
| Large disc / half-circle / side-panel Wheel | visible Wheel is a lower-right 90° quarter arc |
| Wheel as circular panel/disc | Wheel is line/tick/label overlay only |
| Filter as multi-row button grid | Tag and Year are separate compact controls; placement provisional |
| Full detail Card near selected point as required surface | full details move to overlay drawer; local preview may stay minimal |
| Strong continuous Lissajous line | Lissajous is particle-based / point-cloud-like |
| Old volume meter described as random | live analyser-backed meter in current code is authoritative |
| Map hover changes persistent selection | current Decision: hover/focus is preview; persistent selection remains separate |
| Right-side layout defines Graph width | drawers overlay and never resize/recenter Graph |

---

# 15. Engineering invariants retained from current code

Unless this specification explicitly changes them, preserve:

- existing Works data source and fields
- x/y mapping semantics
- Tag / Year filtering logic
- filtered works only in Archive Wheel
- current Audio Engine
- actual analyser data path
- existing selectedWork store where appropriate
- existing wheel input quality
- point floating
- Reduced Motion final-state correctness
- no new work metadata solely for visual redesign

---

# 16. First implementation pass

## Closed-state-first gate — CURRENT

Before designing any open drawer / expanded Wheel state, finish and review the **fully closed default state**.

Closed-state pass requirements:

- Audio drawer closed
- Work/detail drawer closed
- Archive Wheel closed
- central Graph fully visible and unchanged
- no Graph corner marks
- closed Audio / Work terminals are micro edge indicators only
- closed Archive terminal visually hints at the future quarter-wheel using a small quarter-ring / tick motif, not a generic dot+line or large button
- no open-state composition should be treated as accepted until the closed state is approved



The next pass is primarily a **visual-structure implementation**.

Do not add unrelated product features.

Order:

1. build the centered 1:1 Graph shell with no corner brackets
2. render existing Work Points inside it
3. convert stereo Lissajous into particle rendering
4. add compact provisional Tag / Year top overlay
5. add closed left Audio drawer trigger
6. add closed right Work/Scope drawer trigger
7. add lower-right Archive trigger
8. implement open 90° Archive Wheel state
9. implement left Audio drawer open state
10. implement selected Work right drawer state
11. capture review screenshots

Do not proceed to production polish until the visual structure is accepted.

---

# 17. Acceptance for this visual pass

At 1600×1000:

- Graph center equals viewport center
- Graph width equals Graph height
- Graph is the strongest visual object
- Lissajous reads as particles / point field, not spaghetti line
- no persistent sidebar
- opening drawers does not move the Graph
- Audio opens from left
- Work detail opens as overlay, provisionally right
- Wheel appears at lower-right
- open Wheel shows approximately one 90° quadrant only
- no circular Wheel panel
- Tag and Year are separate
- no multi-row filter grid
- no contradictory old layout rule is reintroduced

Return screenshots of:
1. default / drawers closed
2. Audio drawer open
3. Archive Wheel open
4. selected Work / detail drawer open

This visual pass should be reviewed before any further HUD-density expansion.
