Totally understandable — you're juggling visuals, multiplayer, and polish in a tight timeframe. Here’s a **step-by-step, low-stress approach** to tackle the art pass over the next two days using **Cursor** effectively, while keeping momentum and sanity:

---

## 🧭 Two-Day Methodical Plan (Using Cursor)

### **🏁 Day 1 — Core Visual Cleanup + Feedback Systems (≈ 4–6 hours)**

#### **✅ 1. Environment Cleanup (Start Here)**

* **Prompt Cursor**: Use the “Remove Ground / Add Sky” prompt.
* *Test outcome*: You should immediately feel like the map is floating in stylized space.
* **Why first?** Low risk, huge visual clarity win, zero gameplay impact.

#### **✅ 2. HUD Toggle (Tab Key)**

* **Prompt Cursor**: Use the “HUD Toggle” prompt.
* Ask Cursor to wrap existing debug panels in a container and toggle its `visibility` or `display`.
* *Test outcome*: Game feels cleaner, and you can now test future visuals distraction-free.

#### **✅ 3. Motion Trail System**

* **Prompt Cursor**: Use the “Tron Trail” prompt.
* If Cursor seems unsure, say:

  > “Use a single `BufferGeometry` Line or mesh trail that updates with velocity. Do **not** spawn new objects.”
* *Test outcome*: You get dopamine as you speed up and leave a neon trail.
* **Important**: Profile FPS right after. If perf tanks, pause and simplify before proceeding.

#### **✅ 4. Boost Bar + Vignette**

* **Prompt Cursor**: Use “Boost Indicator” prompt.
* Ask Cursor to:

  * Add a UI `div` with a shrinking width for the bar.
  * Add a fullscreen semi-transparent vignette overlay that fades in/out.
* *Test outcome*: Boost feels satisfying and easy to read.

#### **🎯 End-of-Day Checkpoint**

* ✅ Clean background, no floor tile
* ✅ Can toggle UI for testing
* ✅ Trail works at speed, doesn’t lag
* ✅ Boosts feel good and readable

---

### **🚀 Day 2 — Character Polish + FX + QA (≈ 6 hours)**

#### **✅ 5. Class Visual Differentiation**

* **Prompt Cursor**: Use “Class Identity” prompt.
* Ask it to:

  * Add class-based stripes or attachments to the existing capsule mesh.
  * Reflect class enum changes locally and for remote players.

#### **✅ 6. Dummy FX Pass**

* **Prompt Cursor**: Use “Dummy Polish” prompt.
* Ask Cursor to:

  * Add visual feedback on hit, KO, and respawn (e.g., scaling + emissive ring).
  * Use simple quads and existing materials.

#### **✅ 7. Ability FX**

* **Prompt Cursor**: Use “Ability Micro FX” prompt.
* Let Cursor build one ability FX first (e.g., Blink), test it, then copy pattern to others.
* Make sure to call out:

  > “Avoid memory leaks. Dispose FX if no longer visible.”

#### **✅ 8. QA Checklist + Final Polish**

* Run through **QA table** from the markdown.
* Note any memory leaks, broken visuals, or missing reset behavior.
* Tweak duration, position, or styling *only if broken or unreadable*.

#### **🟨 Optional (Stretch): Audio Skeleton**

* If time left: add background music and SFX via `AudioManager`.

---

## 🛠 Cursor Workflow Tips

* **Split PRs**: Do one feature per PR (or at least per major visual).
* **Preview Often**: Use your HUD toggle and trail for early wins.
* **Commit Often**: After each stable change, push — don’t wait for 5 features to be done.
* **Be Specific, Modular**: “Cursor, please make this a reusable TrailSystem.ts file.”
* **Use TODO.md inside Cursor** to stay grounded in what’s next.

---

## 🧠 Bonus: Daily Reset Ritual (10 min)

Each day:

1. Open your markdown (e.g., `DAY6_ART_PASS.md`)
2. ✅ Check off what’s done
3. 🧠 Pick the **least risky**, most visually rewarding next feature
4. 🎯 Ask: “Does this help players feel or understand more?”

---

## 🧷 Prioritization Rule (If you must cut)

If short on time:

1. Trail
2. HUD toggle
3. Boost bar
4. Dummy polish
5. Class visuals
6. Ability FX
7. Audio

Cut from the **bottom up**.

---

Let me know if you'd like a **Cursor TODO file** to drop into your project or want help refining the prompts as you go. You've already nailed so much — this is just the final visual layer. You got this.
