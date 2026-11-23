# TH Portfolio — Agent Handoff / Design Spike 01

This file is the repo-local execution contract for the current TH Portfolio visual implementation spike.

## Why this file exists

The live Notion brief is authoritative for the human-facing project state, but some Agents cannot authenticate to that Notion workspace. This file bridges the same current execution contract into a source that the Agent can read from the repository.

Do not guess missing Notion content. Use this file + live repo state.

## Authority order

1. Current user instruction
2. This handoff file
3. Current live repository state / tests / repo-local docs
4. Draft spec PR #9
5. Older repo docs only where they do not conflict with newer Decisions below

Repo: `46slv/th_portfolio`

Handoff base:
- `main`: `243534dc0ec8e7c9939da88994ccb49cf96487f9`
- Draft spec PR #9 head: `bd21e4e1f14899bbb79fa35a19fd2d6635b09915`

Fresh-read current refs before implementation.

## Task type

This is a **visual implementation spike**, not final production.

Do not complete, merge, deploy, or publish the production redesign.

The goal is to produce a runnable branch that uses real project data and real audio analysis so the user can make the next design decisions from an actual browser implementation.

## Product context

Talich Helfen is the user's friend and a composer / arranger.

The site should let visitors enter with music and discover works spatially rather than read a conventional portfolio list.

Do not add fields just to support the redesign.

Existing Work data remains the source:
- `title`
- `artist`
- `year`
- `tags`
- `x`
- `y`
- `url`

Do not add:
- relationship metadata
- exact dates
- roles
- creditNote
- fake telemetry or fake scientific values

## Core information architecture

- **Map = discover**
- **Wheel = browse**
- **Card = read**

### Map

Preserve the existing semantic axes:

```text
           Maniac
              ↑
              │
Electro ←─────┼─────→ Acoustic
              │
              ↓
           Popular
```

Rules:
- keep existing `x / y`
- filtering does not re-layout points
- preserve `+` work points
- preserve slow point floating
- do not turn the Map into a boxed panel
- the screen itself should feel like the Map space
- do not make explicit relationship graph / edge visualization a primary feature

### Filter

- Tag / Year filter works
- Tag filter = ordinary filtering
- Year filter = filtering plus a light temporal-navigation treatment
- x/y coordinates do not change when the Year changes

### Wheel

Archive Wheel is an **overlay navigation system**, not a right-side panel.

Closed:
- only a small radial HUD terminal remains at the right edge
- that terminal is the single open/close control

Open:
- arc expands from that same terminal into the Map
- circle center may remain off-screen
- no background panel
- labels point along the radius, not tangent to the circle
- keep focus station fixed
- work labels move along the arc
- only filtered works appear
- Wheel interaction must continue to support wheel / drag / swipe / keyboard
- only the open overlay region should capture wheel/drag input
- closing Wheel preserves selected work, Card, Map, and filters
- Reduced Motion reaches the same final open/closed state without the full transition

### Card

Card / shared tooltip is the primary detailed information surface.

Keep work details out of the rest of the HUD.

Use existing data:
- thumbnail when available
- artist
- year
- title
- tags
- work access action

## Selection semantics

Current repo Decision overrides older Wheel spec:

- Map hover / focus = temporary preview
- Archive Wheel interaction = persistent selection

Do not restore hover → persistent selectedWorkId unless explicitly required by new user direction.

The old `Archive Wheel × Works Map` document still contains the older hover-driven selection model. Treat that part as superseded.

## Audio facts from current code

Current `audioEngine.ts` already exposes real analyser-backed data:

- mono time-domain waveform
- left waveform
- right waveform
- actual meter level
- playback state
- playbackRate

Current Audio controls:
- Master Gain
- Relativistic Shift
- Distortion / Entropy
- Delay / Echoes
- Reverb / Space
- Play / Pause
- shift status

Important reconciliation:
- older site spec says volume meter is random, but live code now calculates it from analyser data. Live code wins.
- current Map Lissajous is L=X, R=Y and uses the existing audio visual frame.
- current waveform + Lissajous render path runs from the actual audio graph.

## Visual direction to test

Do not imitate a generic sci-fi HUD.

Target:

> a quiet survey instrument for observing Talich Helfen's works and sound

Fixed direction:
- no central Map rectangle
- dark neutral / silver / cool white
- cyan mainly for active / selected
- thin strokes
- calibration ticks
- precise geometry
- locally high information density
- broad quiet spatial areas remain

Test:
- low-opacity dot matrix / scan structure
- sparse measurement arcs
- selected Point observation ring / leader line / micro label
- small instrument-like Audio HUD
- radial Archive HUD trigger
- richer local detail only near selected / active interaction

Do not fill the whole screen with boxes or explanatory panels.

## Audio → ambient spectral field

Re-map existing analyser data into the Map background instead of only adding more waveform panels.

Candidate mappings:
- mono amplitude → particle density / brightness
- actual meter level → particle activity / trail strength
- left/right relation → field spread / direction
- waveform history → sparse spectral trails
- stereo Lissajous → line / points / fragmented trace comparison

Constraints:
- particles are visual only, never hit targets
- particles must not be confused with Work Points
- pause / no audio still leaves the Map legible
- Reduced Motion must keep the state usable
- prefer reusing the existing analyser/update path rather than introducing an unjustified heavy permanent loop
- the visualizer must not become the main subject

## HUD layers

### Persistent HUD

Keep visible:
- Talich Helfen / Composer・Arranger identity
- Tag filter
- Year navigation
- Audio / Space controls
- Contact access

### Context HUD

Only when preview/selected as appropriate:
- Work Card
- observation ring
- short leader line
- local state label
- local particle response

Do not annotate every Work Point at all times.

### Audio HUD hierarchy

Do not give every control the same weight.

First candidate hierarchy:
- primary: Play/Pause, Master, Relativistic
- secondary: Distortion, Delay, Reverb
- monitoring: actual meter / spectral activity / shift state

## Year temporal transition

Year changes should feel slightly like moving backward/forward through time.

Rules:
- use existing `year`
- do not add exact-date data
- older Year → slight recede / move deeper
- newer Year → reverse direction
- Map x/y remains unchanged
- transition belongs mainly to the spatial layer
- Card / Wheel / text remain readable
- no hard scene cut
- Reduced Motion uses a much calmer direct state change

Exact duration/easing/parallax/scale/streak values are candidate design details, not fixed product contract.

## Existing implementation to preserve where useful

Prefer reusing:
- Google Sheet → works
- `Work` type and existing data
- `workIds.ts`
- `workSelectionStore.ts`
- Archive Wheel input logic
- Audio Engine
- BGM
- analyser path
- Astro / Cloudflare configuration
- useful tests

Areas intentionally open for refactor:
- `src/components/WorksMap.astro`
- Map renderer / interaction boundary
- filter orchestration
- Year transition
- preview vs persistent selection plumbing
- Card placement / touch behavior
- `VisualShift.ts` full-screen CSS filter approach
- old boxed Audio HUD layout

Do not re-concentrate Entry / Audio / Filters / Map / Card / visualizer orchestration into one monolithic component.

## Three.js

Three.js is not required.

Use it only if it materially improves the Map spatial layer:
- Year transition
- depth / parallax
- particle field
- Relativistic Shift
- shaders / spatial effects

Do not move Wheel / Card / Contact / text UI into WebGL.

Do not adopt Three.js merely because it looks sophisticated.

## Relativistic Shift

Still unresolved as a final product surface.

Do not lock the final visual model.

Current direction only:
- should be more than a numeric speed control / global color filter
- likely belongs mainly to the Map spatial layer
- should not destroy Card / text / work-image readability
- current full-screen `VisualShift.ts` CSS filter approach is allowed to be reconsidered

For this spike, create a replaceable effect boundary if needed, not a final relativity simulator.

## First spike path

1. Create a dedicated implementation branch from the current intended base.
2. Run baseline build/tests.
3. Remove boxed central Map treatment and establish full-field Map shell.
4. Reconnect existing filters / selection / Wheel / Audio.
5. Implement radial Archive overlay contract.
6. Use actual analyser data for at least one spectral particle / trace candidate.
7. Implement one minimal selected/context observation HUD candidate.
8. Re-layout Audio HUD with explicit hierarchy.
9. Add light Year temporal transition.
10. Make the desktop screen genuinely usable in a browser.

## Done

Return:
- runnable implementation branch
- exact branch and commit
- `npm test` result
- `npm run build` result
- desktop screenshot: normal state
- desktop screenshot: Archive open state
- desktop screenshot: selected / context HUD state
- concise list of visual decisions implemented
- explicit list of candidate / not-yet-fixed choices
- exact places that are easy to toggle/remove/tune during user review

The spike succeeds when the user can review the screen and classify design elements as:

- always visible
- state-only
- ambient
- remove

## Verification now

This is T0/T1 spike verification.

Check:
- build
- existing affected tests
- primary flow smoke
- filter contract
- Wheel contains filtered works only
- Wheel open/close
- Wheel scroll / drag
- persistent selection survives Wheel close
- audio start / pause
- analyser visual does not block pointer interaction
- Reduced Motion still reaches correct final states

Do not block this spike on:
- full cross-browser matrix
- long-duration performance sweep
- final mobile polish
- final Relativistic Shift physics/art direction
- production release hardening

## Stop / consult

Stop instead of guessing if implementation requires:
- new Works metadata
- changing Map axis semantics
- relocating points on ordinary filtering
- placing large work-detail content outside the Card
- abandoning Wheel interaction contract
- adding fake telemetry as product information
- finalizing Relativistic Shift product behavior
- expanding Three.js into Wheel / Card / text UI
- merging / deploying / publishing production

## Review questions to answer with the result

- Is the information density too low / right / too high?
- Does spectral field strengthen or obstruct work discovery?
- Is the persistent Audio HUD too large?
- Is selected observation HUD useful?
- Does Archive overlay feel like part of the Map rather than a panel?
- Is cyan / any secondary accent too strong?
- What should be removed before production?

