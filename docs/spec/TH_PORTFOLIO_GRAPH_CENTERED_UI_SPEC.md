# TH Portfolio — Graph-Centered UI Specification vNext

Status: **CURRENT CANONICAL UI / LAYOUT SPEC**
Date: 2026-11-23
Scope: visual hierarchy, graph geometry, overlays, Audio UI, filters, Archive Wheel, work detail, and audio visualization.

Start with the [requirements and decision history](TH_PORTFOLIO_UI_REQUIREMENTS_HISTORY.md). The current review candidate is the right-centre half-arc Wheel in §10; v8/v9 remain earlier references, not the current geometry.

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
- previous opaque Wheel panels, full circles, and the earlier lower-right quarter arc for this review pass
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

~~~text
[Tag / Year overlay: provisional]
[Audio]       [CENTRED GRAPH]       [ARCHIVE: right-edge half-arc]
                                     [Work detail when selected]
~~~

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

# 3A. Pseudo-particle environment layer — CONFIRMED

## 3A.1 Purpose

画面全体の情報量と空間密度を高めるため、Work PointやLissajousとは別系統の**疑似パーティクル群**を常時表示する。

これは平面的な装飾ドットではなく、main interfaceの最奥に存在する環境レイヤーとして扱う。

## 3A.2 Motion model

各pseudo particleの最終移動量は、概念的に次を合算する。

```text
particle displacement
  = base random drift
  + audio-reactive displacement
```

### Base random drift

- particleごとに異なる微小な方向・速度・位相を持つ
- 完全停止せず、常に小さく漂う
- deterministic seed / low-frequency noise等、再現可能で破綻しにくい方式を優先してよい
- 画面全体を激しく流す用途ではない

### Audio-reactive displacement

- overall levelだけでなく、可能ならfrequency bandごとのenergyを使う
- low / mid / high等の帯域ごとに倍率を持たせてよい
- particleごとにband weightやdirection couplingを変え、細かい反応差を作る
- audio由来の値は主に移動量 / 揺れ量へ加算する
- 音量が大きいほど全粒子が同じ方向へ大きく飛ぶような単純反応は避ける

概念例:

```text
motion =
  randomDrift
  + lowBand  * lowWeight
  + midBand  * midWeight
  + highBand * highWeight
```

exact FFT bins / weighting / integration methodはimplementation detailであり、現時点のproduct contractではない。

## 3A.3 Visual depth

- screen-space XYの均一ドットグリッドは禁止
- particle size / opacity / blur / density差でZ-depthを感じさせる
- back layerほど小さく・暗く・ぼけてもよい
- Lissajous particleと視覚的に混同しない
- Work Pointより弱いcontrastにする
- pointer-eventsを持たせない

## 3A.4 Mock behavior

Visual mockではpseudo particlesは静止していてよい。

Mockの目的は以下の確認:

- 粒子密度
- 奥行き
- Lissajousとのレイヤー分離
- Graph / Pointの可読性

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

# 5. Layer stack / Overlay / Drawer system — CONFIRMED

The interface is explicitly layered.

**Main interface** = pseudo-particle field + Lissajous + Graph axes/labels + Work Points.  
Everything else is an overlay/drawer above that main interface.

Opening a drawer must not move, resize, or re-center the Graph.

Use fixed/absolute overlay layers with explicit z-order.

Canonical visual layer order, back to front:

```text
0   base surface
5   pseudo-particle environment field
10  Lissajous particle field
20  Graph axes / labels / center markers
30  Work Points
40  preview / selection indicators
60  drawer / overlay surfaces
70  Archive Wheel overlay
80  transient tooltip / feedback
```

The screen should be understood as a layered information interface, not a set of equally weighted permanent panels.

## 5.1 Main interface

The following belong to the persistent main interface:

- pseudo-particle environment
- Lissajous particles
- Graph cross / axis / labels
- Work Points
- minimal selected / preview marks

These remain spatially stable while drawers open.

## 5.2 Overlay behavior

Audio / Archive / Filter-Sort / work detail / other control surfaces belong above the main interface.

When a major drawer / modal-like overlay such as Audio, Work detail, or Filter-Sort is open:

- dim the main interface behind it
- apply a subtle blur to the main interface behind it
- preserve enough visibility that the spatial context remains recognizable
- do not make it feel like a page navigation or separate screen
- drawer content itself remains sharp

**Archive Wheel is an exception.** Archive Wheel belongs to the same spatial browsing surface as the Graph / Work Points. Opening Archive Wheel by itself must **not** dim or blur the main interface, because Work Points need to remain clearly visible while browsing the Wheel.

If Archive Wheel is open at the same time as another blur-producing drawer/overlay, the other overlay may still cause the main-interface dim/blur.

Dismissal contract:

- clicking an empty/background area outside the active overlay closes it
- the dimmed/blurred main interface acts as the primary dismiss surface while an overlay is open
- drawers also expose a subtle explicit close control such as a small `×`
- repeating the same trigger may also toggle the overlay closed where that interaction is already natural
- `Escape` closes the active overlay(s)
- clicks inside the overlay must not accidentally dismiss it

The effect should communicate depth ordering, not merely decoration.

First visual-pass target may use a subtle combination such as:

```css
filter: brightness(0.55–0.8) blur(2–6px);
```

Exact values are visual-tuning parameters, not fixed API.

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

# 7. Sort / Filter — CONFIRMED behavior, PLACEMENT UNRESOLVED

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

## 7.2 Placement — UNRESOLVED

The final location is intentionally undecided.

Current candidates include:

1. upper-left / top strip
2. dedicated overlay/drawer
3. distribution around the left/right information regions

Do not promote any current mock placement to a fixed requirement.

Requirements that are fixed regardless of placement:

- Tag and Year remain separate concepts
- filtering logic is decoupled from visual placement
- moving Sort / Filter later must not require changing Graph or Wheel semantics
- avoid a large permanent multi-row button grid

Current mock placement is reference-only.

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
- no persistent WORK launcher in the current visual pass; detail is reached through work selection
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

# 10. Archive Wheel — confirmed interaction, current geometry candidate

## 10.1 Placement / shape — PROVISIONAL, next preview

The newest direction is to try a half-arc at the middle of the right edge. Align the centre of its circle with the Graph's horizontal axis and the viewport's right edge. Render the **left half of the circle inside the viewport**, about 180°, from upper to lower arc. Do not draw a filled panel, full ring, or opaque sidebar. The radius scales with viewport height and available width; exact radius, label density and mobile fallback are review choices, not approved constants.

The prior lower-right quarter arc remains the v8/v9 reference and is superseded **for this preview**, not retroactively deleted. The original lower-left placement remains legacy.

## 10.2 Closed / open — retained visual contract

- Closed: show ticks only on a small arc, without a ring or standalone decorative icon. Ticks are clearest near the arc midpoint and fade/blur toward both ends; their visible span does not imply a large rectangular hit area.
- Open: expand from the same origin and reveal the radial work labels. The Graph stays centred, sharp and undimmed when only the Wheel is open.
- Labels follow the radius, perpendicular to the circumference, not tangent; flip orientation on the opposite side only as needed for readable text. Focus and nearby entries read first. Keep decorative ticks out of the hit area.

## 10.3 Input and shared work state — CONFIRMED

- Tag and Year filter the existing work set; the Map keeps existing coordinates; the Wheel lists/selects only the filtered set.
- Preserve mouse wheel, drag, touch/swipe and keyboard browsing as supported by the current product. Restrict input capture to intended controls; browsing should not steal clicks from the empty Graph field.
- Focus/hover is transient; persistent selection is separate. The v9 candidate highlights the linked Point and opens Work detail on explicit selection, then returns to browsing when detail is dismissed. Details can dim/blur the Graph; the standalone Wheel never does.
- Don't make scroll/drag or animation essential; provide visible or keyboard equivalents and verify the Reduced Motion final state.

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


## 12.1 Spacing / keyline discipline — CONFIRMED

All visual mocks and future implementation candidates must use a shared spacing/keyline system.

- Align outer margins and repeated UI groups to common keylines.
- When no stronger reference or component rule exists, use an **8px base grid**.
- Preferred default spacing steps: `8 / 16 / 24 / 32` px.
- Do not introduce arbitrary offsets merely to make one local element look correct.
- Optical correction is allowed when text metrics or radial geometry require it, but the parent alignment/keyline should still be traceable to the 8px system.
- For the current 1600×1000 desktop mock, use `32px` as the default outer UI margin unless the central Graph centering requirement overrides it.

## 12.2 Background spatial texture — CONFIRMED

A flat, screen-space dot grid is not part of the current visual language.

- Do not cover the entire viewport with a uniform XY dot matrix.
- Default background should remain near-black and visually quiet.
- If point texture is reintroduced, it must communicate **depth / Z-space**, not merely a flat XY grid.
- The pseudo-particle environment sits behind the Graph; perspective size/opacity may suggest depth without moving this layer in front of Points.
- Depth particles must remain visually weaker than Work Points and the central Lissajous field.
- Tune the depth field down if it harms Graph readability. A static quiet fallback is preferable to a decorative flat grid or essential motion.

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
│               Archive: right-centre half-arc trial   │
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
- Wheel open right-centre half-arc candidate
- work selected / right detail drawer open

---

# 14. Legacy conflict table

The following older rules are explicitly superseded.

| Older rule | Current rule |
|---|---|
| Works Map inside a bordered square/panel | Graph has no visible container border |
| Audio HUD permanently on the right | Audio controls live in left overlay drawer |
| Archive Wheel on lower-left | Right-centre geometry is the current preview candidate; lower-right is the v8/v9 reference |
| Solid disc / opaque half-circle / side panel | thin right-centre half-arc for the current preview, without a filled panel |
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
- closed Audio trigger is a micro edge indicator; no persistent WORK launcher
- closed Archive terminal hints at the expanded arc using fading ticks only, not a visible rim or large rectangular button
- no open-state composition should be treated as accepted until the closed state is approved



The next pass is primarily a **visual-structure implementation**.

Do not add unrelated product features.

Order:

1. build the centered 1:1 Graph shell with no corner brackets
2. render existing Work Points inside it
3. convert stereo Lissajous into particle rendering
4. add compact provisional Tag / Year top overlay
5. add closed left Audio drawer trigger
6. link work selection to the detail drawer; do not add a persistent WORK trigger
7. prototype the right-centre Archive trigger, aligned to the Graph axis
8. prototype the open right-centre half-arc
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
- on the current geometry trial, the Wheel centre aligns with the Graph horizontal axis at the right edge
- only the inward half-arc is shown, without a background panel or blur from the Wheel itself
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
