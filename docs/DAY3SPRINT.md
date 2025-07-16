Absolutely. Here's your **🎯 Day 3 Sprint — “Combat Core”** checklist in the same format as Days 1 and 2, fully customized for your codebase and PRD priorities:

---

### 🎯 Day 3 Sprint — “Combat Core”

Today’s goal is to build out **local melee combat**, including **cone hit detection**, **damage**, **KO and respawn**, and **basic health regen**. This will unlock *moment-to-moment tension* in your lap loop and prep the foundation for multiplayer syncing.

| #     | Task                           | What to do                                                                                                                                        | Cursor prompt ideas                                                                                                |
| ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **1** | **Cone Sweep + Damage Logic**  | • On `LMB`, cast a 90° ray-fan 1.8 m forward from camera.<br>• If enemy in cone, apply class-specific damage (Blast: 60, Blink: 50, Grapple: 40). | “Create a `performMelee()` that does a cone-sweep using multiple raycasts and returns hit entities.”               |
| **2** | **Health & Damage System**     | • All players have 100 HP.<br>• Hits reduce HP.<br>• After 4s no damage, begin regen at 25 HP/s until full.                                       | “Create a `useHealth()` hook that tracks HP, triggers regen after 4s idle, and exposes a `takeDamage()` function.” |
| **3** | **KO & Respawn Logic**         | • When HP ≤ 0, freeze player, play fade effect, respawn at last checkpoint with full HP after 3s.                                                 | “Add `triggerKO()` that disables input, starts a 3s timer, then calls `respawnPlayer()` with safe CP position.”    |
| **4** | **KO Reward & Knockback**      | • Attacker gets +30% speed buff for 5s on KO.<br>• Hit player receives knockback proportional to damage (dmg × 0.4) in swing direction.           | “On successful melee hit, apply impulse to enemy in camera forward direction scaled by damage.”                    |
| **5** | **Basic Target Dummy**         | • Spawn a static capsule mesh tagged “enemy” to test cone sweep and KO.<br>• Dummy respawns on KO for reuse.                                      | “Create a dummy player object that stands in one place, can be hit and KO’d for testing.”                          |
| **6** | **HUD Health Bar & Damage FX** | • Add a simple red HP bar at bottom-left.<br>• Flash red vignette or screen when hit.<br>• Add subtle shake or audio on melee impact.             | “Create `HealthHUD.tsx` that renders HP bar and flashes red screen overlay when `takeDamage()` is called.”         |

---

### 🧠 Combat Reference Numbers

| Action      | Value             |
| ----------- | ----------------- |
| Cone Angle  | 90°               |
| Melee Range | 1.8 m             |
| KO HP       | 0                 |
| Regen Start | 4s after last hit |
| Regen Speed | 25 HP/s           |
| KO Buff     | +30% speed for 5s |
| Knockback   | dmg × 0.4 impulse |

---

### Suggested commit structure

```
client/
  src/
    combat/
      performMelee.ts
      useHealth.ts
      Knockback.ts
    hud/
      HealthHUD.tsx
    systems/
      Respawn.ts
      KOReward.ts
    test/
      DummyEnemy.ts
```

---

### After you push Day 3

1. Run a full lap while trying to KO the dummy a few times — verify:

   * KO, respawn, and regen work fluidly
   * Each class deals correct damage
   * Knockback gives oomph
2. Push a demo clip of a successful KO + respawn + buff sequence.
3. We’ll greenlight Day 4: Block, slipstream, and pre-socket polish.

---

Ready to cook melee?
I can now generate Cursor prompts for any task you want (especially Task 1 or 2). Just say the word. 🗡️💥

---

## Gameplay Mode Decision (MVP)

We're currently using **PvE Dummy Targets** for the MVP. Players will race around the track and hit dummy targets placed on or near the course. Dummies will grant **speed boosts** or other bonuses (e.g. cooldown resets). This ensures the game remains satisfying and testable even without multiplayer.

We are **pinning a future extension (Option 3)** to include PvP combat *alongside* the dummy system. In this version, dummies would remain as optional boost pickups, while players could also melee each other for points or disruption. We'll explore this hybrid mode if there's time after MVP polish.
