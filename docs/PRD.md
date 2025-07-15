# Battle‑Race Melee FPS – Product Requirements Document (Game‑Week Prototype)

## 0 — Goal Statement

Build, in **7 days**, a low‑poly browser game where 2‑8 players race through an intersecting figure‑8 course while melee‑dueling using high‑mobility abilities. The prototype must prove:

- **Emergent complexity** from simple rules (movement + melee + knockback).
- **Fluid performance** (60 fps on low‑spec laptops, low‑latency multiplayer).
- **Player agency** via three distinct mobility classes balanced around equal time‑to‑goal.

---

## 1 — Design Pillars

1. **Movement Is King** – every mechanic is active, momentum‑friendly, and readable.
2. **Race ↔ Fight Tension** – progress and combat mutually reinforce; neither can be ignored.
3. **Fair Skill Ceiling** – universal HP/speed, quick‑block, auto‑regen, and slipstream keep newcomers competitive while rewarding mastery.
4. **Simplicity First** – ship the core loop; postpone anything that doesn’t serve MVP fun.

---

## 2 — Tech & Stack

| Layer | Decision |
| --- | --- |
| Rendering | **three.js (r148)**, WebGL‑2, low‑poly assets |
| Physics | **Rapier.js** (WASM) — built‑in rope joints & impulse forces |
| Networking | Node 18, **Socket.io v4** snapshot‑interpolation, tick = 60 Hz |
| Server Hosting | Local dev → **Fly.io 256 MB free VM** for demo |
| Build / Tooling | Vite, TypeScript, GitHub, Cursor AI assistant |
| Perf Budget | ≤ 2 ms physics frame, ≤ 50 k total tris, 256 px textures, ≤ 50 KB/s per client |

---

## 3 — Core Game Loop

```
Spawn → Checkpoint A (Momentum Pad) → Checkpoint B (Combat Arena) → Checkpoint C (Vertical Climb) → Finish Gate

```

- **Round timer:** 60 s (overtime until leader finishes).
- **Victory:** first across Finish *or* farthest checkpoint progress on timer.
- **Respawn:** KO or fall → respawn at previous checkpoint (≈5 s loss).
- **KO Reward:** +30 % speed buff, decays linearly over 5 s (cap +30 %).
- **Slipstream:** if >10 m behind nearest rival, +15 % top speed until gap <5 m.

### Checkpoint Functions

| Node | Function & Intent |
| --- | --- |
| A | Momentum Pad: on touch, +10 % speed for 4 s — racing incentive |
| B | Tight bridges / low walls — focal combat area |
| C | Vertical wall; KO here respawns on ground to punish fell leader |

---

## 4 — Combat & Defense

- **Damage model:** shared 100 HP pool.
- **Cone Sweep Swing:** 90° (default) ray‑fan 1.8 m range.
- **Class damage:** Blast 60 HP, Dash 50 HP, Grapple 40 HP.
- **KO threshold:** 100 HP → respawn.

### Defense Layer

| Input | Window | Effect | Cooldown |
| --- | --- | --- | --- |
| RMB **Quick‑Block** | Hold | Reduce dmg → 25 %, knockback ½ | 0.5 s lockout after release |
| **Parry** (stretch) | Tap; 0.15 s window | Nullify dmg, attacker stagger 0.4 s | 1 s CD |
| **Dodge** | Class mobility ability (blink i‑frames, blast jump, swing sidestep) | – | inherent |

### Healing

- **Auto‑regen:** begins 4 s after last dmg; 25 HP/s until 100 HP.
- **No med‑kits** for MVP; optional pickups post‑jam.

---

## 5 — Classes (Equal base speed ≈ 8 m/s)

| Kit | Mobility Ability | Cool‑down | Melee Variant | Trade‑off |
| --- | --- | --- | --- | --- |
| **Blast‑Jumper** | Radial impulse 2.5 m; self + others affected | 3 s | Long staff (range +25 %) 60 HP | 0.3 s post‑blast recovery |
| **Grapple‑Swinger** | 20 m rope; auto detach at apex | 4 s | 360° air sweep, 40 HP | −10 % ground speed while CD active |
| **Blink‑Dasher** | 8 m instant blink; 6 f i‑frames | 2.5 s | Standard swing; if swung ≤0.5 s post‑blink → +20 HP bonus | Stamina drains, halving regen for 1 s |
- **Slide/Surf:** all kits may crouch‑slide; Blink maintains momentum via low‑fric slide.

---

## 6 — Controls (Keyboard + Mouse)

- **WASD** Move · **Space** Jump · **Shift** Slide · **LMB** Swing · **RMB** Block · **E** Class Ability · **Esc** Menu

---

## 7 — Art & Audio

- **Visuals:** neon emissive palette (#FF0080, #00E6FF, white), capsule player meshes, Mixamo rigs stretch goal.
- **FX:** trail renderer on speed >12 m/s, screen shake on KO.
- **Audio:** synthwave 120 BPM loop, “thwack” & “whoosh” SFX from freesound.

---

## 8 — Milestone Schedule (T‑7)

| Day | Deliverable |
| --- | --- |
| 0 | Repo init, Rapier scene, pointer‑lock FPC. |
| 1 | Greybox map + checkpoint triggers + lap logic. |
| 2 | Implement mobility abilities; test single‑player traversal parity. |
| 3 | Cone melee + damage + KO + auto‑regen. |
| 4 | Quick‑block + knockback physics + KO speed buff + slipstream. |
| 5 | Socket.io sync; 2‑client local; deploy to Fly dev. |
| 6 | Art pass, UI HUD, basic audio. |
| 7 | Balance pass, playtest, trailer GIF, itch.io page. |

---

## 9 — Stretch Goals (post‑jam)

- Parry mechanic, projectiles, additional classes, AI ghosts, cosmetics, 2‑D mode.

---

## 10 — Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Grapple physics instability | Use Rapier joint limits; clamp swing speed; auto‑detach on >120°. |
| Net latency melee desync | Server authoritative hit check; send input predictions. |
| Player nausea | FOV slider 90–110; optional motion blur toggle. |

---

## 11 — Glossary

- **KO** – reduce HP to 0, triggering respawn.
- **CD** – cooldown.
- **Slipstream** – conditional speed bonus based on distance.