### 🎯 Day 5 Sprint — “Multiplayer MVP (Socket.io v4)”

The mission is to stand‑up a **2‑client local multiplayer prototype** that cleanly synchronises player movement, abilities, and dummy interactions.  Everything is LAN‑play first; hosting on Fly.io comes at the end of the sprint.

| #     | Task                             | What to do                                                                                                                                                                                      | Cursor prompt ideas                                                                                                |
| ----- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **1** | **Server Scaffold**              | • `npm init -y` in `server/`.<br>• Express + Socket.io v4 HTTP server (`/ping` health route).<br>• Global tick loop = **60 Hz**.<br>• Broadcast `state` object each tick.                       | “Generate a minimal Node 18 Socket.io server with tick loop broadcasting `players` hash 60 ×/sec.”                 |
| **2** | **Client Socket Layer**          | • In `client/src/net/` add `Network.ts`.<br>• Connect, handle `state` packet, emit `input` packet (WASD, mouse buttons, ability key).<br>• Packet rate: **30 Hz** outbound.                     | “Create a `Network.ts` that serialises local input, sends to Socket.io room, and exposes latest remote snapshots.” |
| **3** | **Authoritative Movement**       | • **Server** = source of truth: stores position/velocity, runs **Rapier** step (headless).<br>• **Client** = interpolates/rewinds using *snapshot‑interpolation* lib (or simple 100 ms buffer). | “Add server‑side Rapier world that advances 60 ×/sec and sends compressed transform arrays to clients.”            |
| **4** | **First 2‑Client Smoke Test**    | • Run `node server/index.js`.<br>• Open two browser tabs → both capsules visible, updated at ≤100 ms lag.                                                                                       | –                                                                                                                  |
| **5** | **Ability & Combat Replication** | • Send ability activation events (`class`, `timestamp`, `params`).<br>• Server applies blast/grapple/blink forces & damage, broadcasts new HP + KO.                                             | “Extend server tick to process queued ability events and modify physics bodies accordingly.”                       |
| **6** | **Dummy Authority**              | • Server already owns dummy HP & respawn timers.<br>• Clients only play hit FX.                                                                                                                 | “Move dummy `takeDamage`/respawn logic to server; clients get `dummyUpdate` packets.”                              |
| **7** | **Deployment Stub (Fly.io)**     | • `fly launch` → **256 MB** free VM.<br>• Add `Procfile` or `fly.toml` for `node server/index.js`.<br>• CORS allow origin `*` for now.                                                          | “Generate a Fly.io `fly.toml` for a Node 18 Socket.io server listening on \$PORT.”                                 |

---

#### 💾 Suggested repo layout

```
/server
  index.js
  physics/
    RapierWorld.js
  rooms/
    RoomManager.js
/client
  src/
    net/Network.ts
    net/SnapshotBuffer.ts
    systems/RemotePlayer.ts
    ...
```

---

#### 🔢 Networking Reference Numbers

| Item              | Value              |
| ----------------- | ------------------ |
| Tick rate         | **60 Hz**          |
| Client input send | 30 Hz              |
| Snapshot delay    | 100 ms buffer      |
| Max players       | 8                  |
| Packet budget     | ≤ 50 KB s⁻¹ client |

---

### After you push Day 5

1. **Local LAN test**

   * Two tabs can see each other, abilities interact, KO/respawn syncs.
2. **Latency sanity**

   * Artificially add 150 ms lag (`tc qdisc` or Chrome throttling) → motion still smooth.
3. **Deploy to Fly.io**

   * Share public URL; remote friend joins and completes a lap.
4. **Record a 30‑sec clip** of two players blasting each other off the track.

---

### ⚠️ Implementation Tips / Safeguards

* **Diagnostics first** – have server echo back your input to verify packet paths before physics.
* **Fallback keys** – keep `window.location.hash=#offline` to disable networking quickly.
* **Don’t refactor core logic** – wrap existing systems; server can import shared modules (e.g., damage constants) without touching client code.
* **Start with position/rotation only** – add velocity, HP, ability state once the pipe is stable.

---

Ready for the netcode grind?
Tell me which task you’d like a **Cursor prompt** for and I’ll draft it! 🛰️
