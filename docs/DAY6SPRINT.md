Absolutely — here’s a **Day 6 Sprint** markdown in the same structure and tone as your previous ones. This one focuses on a **barebones lobby & race flow**, enabling multiplayer races with synced starts and end screens.

---

### 🎯 Day 6 Sprint — "Lobbies, Classes & Race Flow"

Today’s goal: introduce a **playable game loop** with class selection, basic lobbies, and synced multiplayer races. This gives structure to the chaos — players can choose their role, race with others, and see how they did at the end.

---

| #     | Task                             | What to do                                                                                                                                                  | Cursor prompt ideas                                                                                            |
| ----- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **1** | **Homescreen UI**                | • Show two big buttons: “Singleplayer” and “Multiplayer” (and maybe Settings).<br>• Display on first load or after race ends.<br>• Hide game HUD while on homescreen.            | "Create a simple HTML UI with two buttons: Singleplayer and Multiplayer. On click, call `startMode(mode)`."    |
| **2** | **Class Selection Panel**        | • After mode selected, let player choose between Blink / Jump / Swing.<br>• Show icons or buttons, highlight selected.<br>• Store choice for use in race.   | "Add a character class selection menu (3 options) that appears after picking game mode. Store selected class." |
| **3** | **Singleplayer Flow**            | • Load player onto track.<br>• Solo dummy KO score + lap time + checkpoints, as usual.<br>• After time or finish, return to homescreen.        | "On 'Singleplayer' click, spawn local player with selected class and start race immediately."                  |
| **4** | **Multiplayer Lobby Join**       | • On ‘Multiplayer’, auto-join (if advisable? or maybe a code...) a lobby (Socket room).<br>• Wait in lobby screen with player name and color.<br>• Show basic 'waiting for players' text.      | "On multiplayer click, connect to Socket.io server and auto-join lobby room. Show current players in lobby."   |
| **5** | **Countdown Start (MP Only)**    | • Host (first to join) sees ‘Start Race’ button.<br>• Clicking sends `startCountdown` to others.<br>• Everyone gets 3-2-1 countdown and race begins.        | "Add Socket event `startCountdown` that triggers a synced countdown on all clients before race begins."        |
| **6** | **Leaderboard & Return to Menu** | • When race ends (time or laps), show simple leaderboard:<br> • Names<br> • Dummy KO count<br> • Scores, etc.<br>• Button to return to homescreen.                    | "Create a basic leaderboard UI that appears after race ends, showing player name, score, laps, etc."       |
| **7** | **Game State Transitions**       | • Wrap all flow in a state machine: Homescreen → Class → Lobby → Race → Leaderboard → Homescreen.<br>• Reset world and players cleanly between transitions. | "Add a GameStateManager that handles transitions between UI views and resets player/game state accordingly."   |

---

### 🔁 Game Loop (Multiplayer)

```text
Homescreen
  → Multiplayer selected
    → Join lobby
      → Host starts countdown
        → 3-2-1 → GO!
          → Race runs
            → Leaderboard
              → Homescreen
```

---

### 📁 Suggested file structure

```
client/src/ui/
  HomeScreen.ts
  ClassSelection.ts
  LobbyScreen.ts
  Leaderboard.ts

client/src/state/
  GameStateManager.ts

client/src/net/
  LobbyManager.ts
```

---

### 🧪 Test Plan

| Scenario                | Should…                                      |
| ----------------------- | -------------------------------------------- |
| 1P singleplayer         | Load instantly, show dummies, return to menu |
| 2P multiplayer          | Both load in lobby, start race at same time  |
| Player leaves mid-lobby | Other still races; lobby clears after end    |
| End of multiplayer race | Leaderboard shown; names + KO scores         |
| Replay                  | Can return to homescreen and do it again     |

---

### 🧱 Stretch Goals (If Time Permits)

| Feature                 | Effort | Notes                                         |
| ----------------------- | ------ | --------------------------------------------- |
| Unlock abilities in SP  | Medium | e.g. complete 2 laps with Blink → unlock Jump |
| Match duration selector | Easy   | Dropdown on lobby screen (30s / 60s / 90s)    |
| All-abilities toggle    | Easy   | Checkbox to allow all classes in single run   |

---

This sprint gives you a **replayable multiplayer structure** with synchronized logic, basic competition, and player choice — all huge polish wins for MVP video day.

Let me know if you want to generate the Cursor prompts one-by-one as you go 👇
