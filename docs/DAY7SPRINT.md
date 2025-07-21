Below is the sprint doc you asked for. You can save it as `DAY6_ART_PASS.md` (or `DAY7SPRINT.md` if you’re aligning to original schedule). It’s **implementation‑clear** but deliberately **code‑agnostic** so Cursor can safely explore your current architecture without breaking things.

---

# 🎨 Day 6 Art & Visual Feedback Sprint — “Readability + Style Pass”

**Goal:** Upgrade presentation (feel + clarity) without refactoring core gameplay.
**Focus:** Trails, HUD cleanliness, boost feedback, dummy look, class identity, removal of temp geometry, and minimal character visuals.

---

## 🔝 High‑Level Priorities (do in order)

| Priority | Feature                                                                 | Rationale                                            |
| -------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| 1        | Remove generic floor tile + add sky / fog backdrop                      | Instantly improves clarity & silhouette; lowest risk |
| 2        | HUD Toggle (Tab) hides *only* debug / dev panels                        | Clean capture mode; preserves race essentials        |
| 3        | Tron‑style continuous motion trail (replaces dotted)                    | Sells speed → supports “Movement Is King”            |
| 4        | Boost Indicator (bar + subtle vignette)                                 | Communicates remaining reward time (agency)          |
| 5        | Class Visual Identity (3 distinct capsules/chars)                       | Readability + class recognition in multiplayer       |
| 6        | Dummy Visual Polish (respawn pulse + emissive ring)                     | Targets become attractive intentional race beats     |
| 7        | Ability / Status FX micro‑pass (blink flash, blast ring, grapple pulse) | Tactile clarity with low scope                       |
| 8        | Audio hooks placeholder (if time)                                       | Feel amplification (optional if behind)              |

---

## 🎯 Deliverables & Acceptance Criteria

### 1. **Environment Cleanup**

* **Remove** the flat tiled “floor/ground” under track.
* Add **sky gradient** (simple inverted sphere/cube or shader) + optional light fog (exp or linear).
* Track edges must remain readable at all FOVs (no extreme haze).
* *Acceptance:* Standing still: no distracting tile pattern; looking outward: clean gradient; FPS unchanged.

### 2. **HUD Visibility Toggle**

* Press **Tab** → toggles “clean mode”.
* Clean mode hides: debug stats, raw logs, dev editor panels.
* Keeps: checkpoint bar, timer, class ability widget, health/score, boost bar (if active).
* Restores state when toggled again.
* *Acceptance:* Press Tab twice = exact original layout restored. No console errors.

### 3. **Tron‑Style Motion Trail**

* Continuous ribbon/line behind local player only (remote players optional / future).
* Only renders above speed threshold (e.g. >12 m/s) & fades out gracefully when slowing.
* Single geometry updated each frame (buffer reuse) or qualified line system (no hundreds of meshes).
* Color shifts or adds additive glow when crossing higher speed tiers (e.g. base cyan → magenta pulse).
* No popping / dot artifacts.
* *Acceptance:* At high speed: appears as smooth luminous streak. At rest: fully invisible. ≤1 ms per frame cost (profile).

### 4. **Boost Indicator**

* **On boost start:**

  * Show bar (horizontal or ring) with countdown (duration shrinking).
  * Apply subtle **screen vignette tint** (e.g. warm gold) that fades with remaining time.
* **On boost end:** quick fade‑out (≤200 ms).
* Non‑intrusive; does not obscure crosshair / forward view.
* *Acceptance:* Activating multiple boosts quickly resets bar correctly; no stale overlays.

### 5. **Class Visual Identity (3 Characters)**

* Keep capsules for performance but add **distinct silhouette accents** (e.g. emissive stripe patterns, top halos, glowing spine).
* Each class assigned consistent accent color (suggested palette below).
* Visible at mid-distance (≥20 m).
* Operates with one shared low‑poly geometry variation or three light variants (<2K tris each if custom).
* *Acceptance:* Switching class updates appearance instantly client‑side; remote players show correct variant.

### 6. **Dummy Polish**

* Add **emissive target ring** (growing pulse) when close to respawn (last 0.75 s).
* On hit: quick scale “squash” + flash accent color (e.g. white → red/pink → settle).
* On boost grant: radial shimmer or brief vertical energy column (simple transparent quad).
* KO state: fade opacity or desaturate color until respawn.
* *Acceptance:* Distinct visual states: idle, hit, KO, pre‑respawn pulse.

### 7. **Ability Micro FX**

| Ability | Minimal FX Goal                                                              | Constraints         |
| ------- | ---------------------------------------------------------------------------- | ------------------- |
| Blink   | Small expanding translucent sphere + quick chromatic / radial blur (if easy) | Lifetime < 200 ms   |
| Blast   | Expanding flat ring (billboard) + brief additive spark core                  | No heavy particles  |
| Grapple | Rope gets traveling emissive pulse when attach; anchor spark                 | Reuse rope geometry |

*Acceptance:* FX spawn exactly once per use; no persistent memory growth.

### 8. **(Optional) Audio Skeleton**

* One loop (music) + 4–5 SFX (blink, blast, grapple latch, boost start, dummy hit).
* Simple `AudioManager` w/ `play(id)` and master volume scalar.
* *Acceptance:* All sounds fire once; no overlapping infinite loops; mute when window hidden (optional).

---

## 🎨 Style Guide (Compact)

| Element             | Color / Treatment                                    |
| ------------------- | ---------------------------------------------------- |
| Global Background   | Vertical gradient (#04050A → #0B1020)                |
| Track Base          | Very dark neutral (#101014) w/ subtle Y gradient mix |
| Trail Base          | #00E6FF → #FF0080 blend at high speed                |
| Boost Accent        | #FFE84D                                              |
| Damage Flash        | #FF3355                                              |
| Class: Blast        | #FF5A3C emissive stripe                              |
| Class: Grapple      | #00E6FF emissive coil                                |
| Class: Blink        | #B880FF soft pulse                                   |
| Dummy Idle          | #AA1122 + target ring #FFFFFF (emissive)             |
| Dummy Respawn Pulse | Ring flicker #FF6688 → #FFFFFF                       |

---

## 🧪 QA Checklist

| Test                         | Expected                                                        |
| ---------------------------- | --------------------------------------------------------------- |
| Toggle HUD spam              | Tab => debug gone, race UI intact                               |
| Trail start/stop             | Appears >12 m/s, fades <12 m/s                                  |
| Trail performance            | Frame time stable (compare before/after)                        |
| Boost overlay stacking       | Multiple boosts never duplicate bars                            |
| Dummy states transition      | Idle → Hit flash → KO fade → Respawn pulse → Idle seamless      |
| Class swap remote            | Two clients: remote color & silhouette update matches selection |
| Ability FX count             | No leftover meshes after 30 activations                         |
| Memory baseline              | Heap does not climb (>5% drift) after repeated effects test     |
| Audio duplication (if added) | No double-start of loop / no click pops on restart              |

---

## ⏱ Suggested Time Breakdown

| Feature                   | Est.              |
| ------------------------- | ----------------- |
| Sky / Fog / Tile Removal  | 0.5 h             |
| HUD Toggle + Clean Layout | 0.5–0.75 h        |
| Trail Implementation      | 1–1.5 h           |
| Boost Bar + Vignette      | 0.75 h            |
| Class Visual Pass         | 1 h               |
| Dummy Polish FX           | 1 h               |
| Ability Micro FX          | 1 h               |
| (Audio Skeleton)          | 0.75 h (optional) |
| **Total (core)**          | \~6 h realistic   |

---

## ⚠️ Risks & Mitigations

| Risk                                     | Mitigation                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Overdraw from trail & vignette           | Limit trail segment count; premultiply alpha; keep vignette single quad.                           |
| Shader compile stalls                    | Reuse base materials; modify via `onBeforeCompile` minimally.                                      |
| Multiplayer bandwidth from class visuals | Only send class enum / color, not geometry.                                                        |
| Visual noise harming clarity             | Gate FX by speed thresholds; keep palette strictly limited.                                        |
| Performance dip on low GPUs              | Provide fallback flag: disable trails & ability FX if frame time >16 ms for 60 consecutive frames. |

---

## 🧩 Cursor Prompt Starters

Use these modularly—one per change—to keep diffs clean.

### A. Remove Ground / Add Sky

> “Identify and remove the temporary ground/floor tile mesh. Add a gradient sky backdrop (inverted sphere or cube) plus light exponential fog. Do **not** alter gameplay colliders.”

### B. HUD Toggle

> “Add a Tab key toggle that hides only debug/dev UI panels (keep race HUD: ability, timer, checkpoints, health/score, boost). Implement via a CSS class toggle on `<body>`.”

### C. Tron Trail

> “Implement a velocity-based continuous trail for the local player: reuse a single dynamic BufferGeometry line or ribbon. Fades alpha by age, color lerps cyan→magenta at high speed, hidden if speed below threshold. Avoid creating new objects each frame.”

### D. Boost Indicator

> “Add a boost UI bar + optional subtle vignette effect that appears during active speed boosts. Countdown visually matches remaining boost time and hides on completion.”

### E. Class Identity

> “Add simple visual differentiators for the three classes (emissive stripe patterns or additional mesh parts) without increasing vertex count excessively. Update local & remote representations when class changes.”

### F. Dummy FX

> “Enhance dummy visuals: hit flash, KO fade, pre-respawn pulsing ring, and boost shimmer effect. No new physics objects; reuse existing meshes or lightweight child meshes.”

### G. Ability Micro FX

> “Add minimal FX for blink (small expanding sphere), blast (expanding additive ring), grapple (rope pulse). Ensure objects are reused or disposed properly—no memory leaks.”

### H. Audio (Optional)

> “Introduce an AudioManager with one looping music track and 4 SFX (blink, blast, grapple attach, dummy hit). Provide simple `play(id)` and volume control.”

---

## 🗂 Suggested File Adds (Non‑Destructive)

```
client/
  src/visual/TrailSystem.ts
  src/visual/BoostOverlay.ts
  src/visual/ClassSkins.ts
  src/visual/DummyFX.ts
  src/visual/AbilityFX.ts
  src/visual/SceneBackdrop.ts
  src/audio/AudioManager.ts   (optional)
  styles/hud.css
```

---

## 🔄 Order of Implementation Script (Copy to TODO)

1. Backdrop + fog
2. HUD toggle + reorganize existing HUD
3. Trail system core
4. Boost overlay & integration with existing boost event
5. Class skin application on class change
6. Dummy FX states
7. Ability FX hooks
8. (Optional) Audio skeleton
9. Performance sanity pass & QA checklist run

---

## 🧪 Verification Script (Manual)

| Step | Action                          | Expected                                     |
| ---- | ------------------------------- | -------------------------------------------- |
| 1    | Load game (clean mode off)      | Full HUD + debug visible                     |
| 2    | Press Tab                       | Debug gone, core HUD stays                   |
| 3    | Accelerate past speed threshold | Trail appears smoothly                       |
| 4    | Slow to walk                    | Trail fades away (≤0.5 s)                    |
| 5    | Hit dummy → get boost           | Boost bar + vignette appear; countdown valid |
| 6    | Switch class 1→2→3              | Visual accents change instantly              |
| 7    | KO dummy / wait respawn         | Hit flash → fade → pulse → reappear          |
| 8    | Use each ability                | Proper FX spawn & disappear                  |
| 9    | Open performance stats          | Stable FPS; no cumulative memory growth      |

---

## ✅ Definition of “Done” for Sprint

* All **MUST** items implemented & passing QA checklist.
* No increase in average frame time > 1.5 ms vs pre‑art baseline.
* No unbounded allocations (confirmed by memory snapshot after 5 minutes stress).
* Trail + boost overlay + class skins all function in multiplayer (at least 2 clients).
* Sprint markdown committed (`DAY6_ART_PASS.md` or equivalent).

---

**Ready to proceed?**
If this layout works, drop it into the repo and begin with the Backdrop + HUD toggle tasks. Need a refined prompt for any single item—just ask. 🎬

Let me know if you’d like an accompanying *balance / feel checklist* for final Day 7 polish.
