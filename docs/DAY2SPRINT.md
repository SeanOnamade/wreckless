Absolutely. Here's a polished **Day 2 Sprint** doc modeled after your Day 1 checklist — focused on **Mobility Abilities** and **Traversal Parity**, just as laid out in your PRD:

---

## 🎯 Day 2 Sprint — “Mobility & Traversal Parity”

Today’s goal is to implement all three **mobility class abilities** and test them on the greybox course to ensure **equal traversal time**. Each ability must feel distinct yet fair, while remaining momentum-friendly.

| #     | Task                                 | What to do                                                                                                                                                                    | Cursor prompt ideas                                                                                                           |
| ----- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Ability Framework**                | • Add `classKit.ts` with shared cooldown, input (`E`), and visual cue logic.<br>• Each class has its own ability + melee.<br>• Start with local-only; networking comes later. | “Create a `useAbility` hook that triggers a class-specific action on ‘E’ press with cooldown and optional animation.”         |
| **2** | **Blast Jump (Radial Impulse)**      | • On press, apply radial force to self and nearby players.<br>• Add visual blast FX + short self-stun (\~0.3 s).                                                              | “Implement a radial impulse ability that launches the player upward and pushes nearby bodies using Rapier.”                   |
| **3** | **Grapple Swing (Rope Joint)**       | • On press, shoot grapple in view direction.<br>• If it hits valid anchor, attach swing joint; auto-release at apex.<br>• Clamp speed; disable regrab for 1.5 s.              | “Add a rope swing ability that fires a grapple hook and attaches a joint if it hits within 20m. Auto-release at apex.”        |
| **4** | **Blink Dash (Teleport + I-Frames)** | • On press, teleport 8 m forward unless blocked.<br>• Give 0.1 s i-frames; disable regen for 1 s after.<br>• If player swings ≤0.5 s after blink, bonus damage.               | “Implement a blink dash that teleports the player 8m forward, grants i-frames, and activates a ‘blinkWindow’ timer post-use.” |
| **5** | **Traversal Test Harness**           | • Spawn at `Checkpoint A`, time how long each class takes to reach `Finish`.<br>• Adjust impulse, swing distance, blink CD to match \~30–35s traversal time.                  | “Write a quick script that logs time from Checkpoint A to Finish for different kits; output to console.”                      |
| **6** | **Cooldown & Feedback Polish**       | • Add a HUD element showing ability cooldown.<br>• Grey out button + timer, flash border when ready.<br>• Add subtle SFX or screen shake per class for feel.                  | “Add simple UI bar for ability cooldown with progress fill and flash animation when ready.”                                   |
| **7** | **Playtest & Movement Polish**       | • Verify:<br> • All three classes can complete a lap in similar time.<br> • No ability causes player to fall off track.<br> • No abuse cases (e.g. grapple-climb walls).      | –                                                                                                                             |

---

### 🧠 Traversal Balancing Reference

| Class       | Expected Use Pattern                               | Balancing Levers                      |
| ----------- | -------------------------------------------------- | ------------------------------------- |
| **Blast**   | Jump just before or during curved slopes           | • Blast force (Y vs X), recovery time |
| **Grapple** | Swing from bridge anchor or wall pipe              | • Max distance, auto-release height   |
| **Blink**   | Dash at key moments on straights + uphill sections | • Blink range, cooldown, regen lock   |

Each kit should feel optimal if mastered, but never required.

---

### Suggested commit structure

```
client/
  src/
    kits/
      useAbility.ts
      blast.ts
      grapple.ts
      blink.ts
    hud/
      AbilityCooldown.ts
    systems/
      MovementBalancer.ts
```

---

### After you push Day 2

1. Log timings for each class and tweak parameters for parity.
2. Push visuals (GIFs or screenshots) of each mobility in action.
3. Then we’ll start **Day 3: Melee, Knockback, and KO system.**

Let’s make movement feel *cracked*. 🌀💥🪝

---

---

## Gameplay Mode Decision (MVP)

We're currently using **PvE Dummy Targets** for the MVP. Players will race around the track and hit dummy targets placed on or near the course. Dummies will grant **speed boosts** or other bonuses (e.g. cooldown resets). This ensures the game remains satisfying and testable even without multiplayer.

We are **pinning a future extension (Option 3)** to include PvP combat *alongside* the dummy system. In this version, dummies would remain as optional boost pickups, while players could also melee each other for points or disruption. We'll explore this hybrid mode if there's time after MVP polish.
