### 🎯 Day 1 Sprint — “Greybox & Checkpoints”

Below is a tight checklist for Day 1, ordered so each task unblocks the next. Knock these out and you’ll have a playable lap loop by tonight.

| #     | Task                           | What to do                                                                                                                                                                                                                        | Cursor prompt ideas                                                                                                                     |
| ----- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Figure‑8 Greybox Mesh**      | • In Blender or simple Three `BoxGeometry` combine two 20 × 4 m straights plus two 10 m diameter quarter–pipe curves.<br>• Export / create as single `Track.glb`.<br>• Add low side‑rails (0.5 m high) to keep players on course. | “Generate a Three.js function that builds a figure‑8 track mesh from boxes and curves, returns a THREE.Mesh ready for Rapier collider.” |
| **2** | **Static Colliders**           | • Use Rapier’s `createTrimesh` from `Track.glb` verts.<br>• Add separate ground collider for performance.<br>• Slope limit ≤20 ° so slide still works.                                                                            | “Wrap Track mesh in Rapier trimesh collider and add to physics world.”                                                                  |
| **3** | **Checkpoint Trigger Volumes** | • Create 3 invisible `BoxCollider` triggers (`CP_A`, `CP_B`, `CP_C`).<br>• Hook `onIntersectionEntered` events to call `lapController.visit(cpId)`.                                                                               | “Add three axis‑aligned trigger boxes at given positions that fire console logs when player enters.”                                    |
| **4** | **Lap Controller**             | • Keep state `{ lastCP, lapTime, laps }`.<br>• If player hits next CP in sequence, update progress; else ignore.<br>• When Finish gate reached with `lastCP === C`, declare `lapComplete()`.                                      | “Write LapController.ts that tracks checkpoint order and emits ‘lapComplete’ event.”                                                    |
| **5** | **HUD Progress Bar**           | • Simple DOM element top‑center: “A B C 🏁”.<br>• Highlight current checkpoint; grey out passed ones.<br>• On lap complete reset bar, increment lap count.                                                                        | “Create HUD that shows checkpoint status and lap timer using plain HTML/CSS appended to document.body.”                                 |
| **6** | **Respawn Logic Stub**         | • Store safe position & yaw every time a CP is passed.<br>• Add temporary `R` key to force‑respawn at lastCP (for testing falls).                                                                                                 | “Add function `respawnAt(checkpoint)` that teleports capsule and zeroes velocity.”                                                      |
| **7** | **Playtest & TODO list**       | • Run two local browser tabs; verify:<br> • Can’t skip CP order.<br> • Slide works on curves.<br> • Falling off track → press R → spawns correctly.<br>• Jot friction/scale tweaks for Day 2.                                     | –                                                                                                                                       |

---

#### Assets / Numbers reference

| Segment      | Length / Radius                                      | Y‑offset | Purpose                    |
| ------------ | ---------------------------------------------------- | -------- | -------------------------- |
| Straight     | 20 m × 4 m                                           | 0 m      | Sprint & KO knockback risk |
| Curve        | 90° arc, r = 10 m, width = 4 m                       | 0 m      | Cross‑over moment          |
| Checkpoint A | At exit of first straight                            | –        | Momentum pad in Day 2      |
| Checkpoint B | Middle of cross‑over bridges                         | –        | Combat arena               |
| Checkpoint C | Base of vertical climb wall (add stairs/ramps later) | –        | Skill gate                 |

*(Feel free to tweak dims after a quick run‑through.)*

---

### Suggested commit structure

```
client/
  src/
    track/Track.glb
    track/TrackMesh.ts
    systems/LapController.ts
    systems/Checkpoint.ts
    hud/Hud.ts
```

---

### After you push Day 1

1. Ping me with the repo link or Cursor summary.
2. We’ll review feel, flag any collision quirks, and slot Day 2 tasks (mobility abilities).

You’re set—happy greyboxing! 🎮
