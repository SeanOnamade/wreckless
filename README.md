# Wreckless

A high-speed battle-race multiplayer browser game where 2-8 players race through an intersecting figure-8 course while engaging in melee combat using mobility abilities.

![Game Status](https://img.shields.io/badge/status-prototype-orange)
![Platform](https://img.shields.io/badge/platform-web-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎮 Game Overview

**Wreckless** is a low-poly browser-based FPS that combines high-speed racing with tactical melee combat. Players choose from three distinct mobility classes and compete to reach the finish line while using special abilities to knock out opponents and gain speed advantages.

### Core Features

- **🏁 Race-Fight Hybrid**: Progress through checkpoints while engaging in strategic combat
- **⚡ High-Mobility Classes**: Three unique classes with distinct movement abilities
- **🎯 Tactical Combat**: Cone-sweep melee attacks with blocking and parry mechanics
- **🌐 Real-time Multiplayer**: 2-8 player online matches with 60Hz tick rate
- **📱 Accessible**: Runs on low-spec devices with 60fps performance target

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Three.js (r148), TypeScript, Vite |
| **Physics** | Rapier.js (WebAssembly) |
| **Networking** | Node.js 18, Socket.io v4 |
| **Build Tools** | Vite, TypeScript |
| **Deployment** | Fly.io |

## 🎯 Game Mechanics

### Classes

| Class | Ability | Cooldown | Damage | Trade-off |
|-------|---------|----------|--------|-----------|
| **Blast-Jumper** | Radial impulse jump (2.5m radius) | 3s | 60 HP | 0.3s recovery time |
| **Grapple-Swinger** | 20m rope swing with auto-detach | 4s | 40 HP | -10% ground speed during CD |
| **Blink-Dasher** | 8m instant teleport with i-frames | 2.5s | 50 HP (+20 HP bonus if used right after blink) | Stamina drain affecting regen |

### Controls

- **WASD** - Movement
- **Space** - Jump
- **Shift** - Slide
- **LMB** - Melee Attack
- **RMB** - Block
- **E** - Class Ability
- **Esc** - Menu

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Modern web browser with WebGL2 support

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/wreckless.git
   cd wreckless
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install client dependencies
   cd client
   npm install
   
   # Install server dependencies
   cd ../server
   npm install
   ```

### Development Setup

1. **Start the development server**
   ```bash
   # In the server directory
   cd server
   npm run dev
   ```

2. **Start the client development server** (in a new terminal)
   ```bash
   # In the client directory
   cd client
   npm run dev
   ```

3. **Open your browser**
   Navigate to `http://localhost:5173` to play the game

### Production Build

```bash
# Build the client
cd client
npm run build

# Start production server
cd ../server
npm start
```

## 📁 Project Structure

```
wreckless/
├── client/                 # Frontend Three.js application
│   ├── src/
│   │   ├── controller.ts   # Input handling
│   │   ├── physics.ts      # Rapier.js physics integration
│   │   ├── main.ts         # Application entry point
│   │   ├── kits/           # Character class abilities
│   │   ├── systems/        # Game systems (checkpoints, laps)
│   │   ├── track/          # Track generation and management
│   │   └── hud/           # UI and HUD components
│   └── public/            # Static assets
├── server/                # Node.js multiplayer server
├── docs/                  # Project documentation
│   ├── PRD.md            # Product Requirements Document
│   └── *.md              # Development logs and specs
└── README.md             # This file
```

## 🎮 How to Play

1. **Choose Your Class**: Select from Blast-Jumper, Grapple-Swinger, or Blink-Dasher
2. **Race Through Checkpoints**: Navigate the figure-8 course hitting momentum pads
3. **Combat Strategy**: Use melee attacks to knock out opponents and gain speed buffs
4. **Mobility Mastery**: Master your class ability for optimal traversal and combat
5. **Victory Conditions**: First to finish line OR furthest progress when timer expires

### Game Flow
```
Spawn → Checkpoint A (Momentum Pad) → Checkpoint B (Combat Arena) → Checkpoint C (Vertical Climb) → Finish Gate
```

## 🔧 Configuration

### Performance Settings
- **Target FPS**: 60 fps on low-spec laptops
- **Physics Frame Budget**: ≤ 2ms
- **Triangle Budget**: ≤ 50k total
- **Texture Resolution**: 256px
- **Network Budget**: ≤ 50 KB/s per client

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the [Three.js best practices](docs/THREE_JS_BEST_PRACTICES.md) outlined in the project
- Use TypeScript for type safety
- Maintain 60fps performance target
- Test multiplayer functionality locally before submitting PRs

## 📊 Performance Monitoring

The game includes built-in performance monitoring:
- FPS counter in development mode
- Network latency display
- Physics frame time tracking
- Memory usage monitoring

## 🐛 Known Issues

- Grapple physics may be unstable on very high ping connections
- Mobile touch controls are not yet implemented
- Audio system is placeholder-only in current prototype

## 📋 Roadmap

### Current Sprint (Prototype Week)
- [x] Basic movement and physics
- [x] Checkpoint system
- [x] Class abilities implementation
- [ ] Multiplayer synchronization
- [ ] Art and audio pass
- [ ] Balance testing

### Post-MVP Features
- Parry mechanic refinement
- Additional character classes
- Spectator mode
- Replay system
- Tournament bracket system

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Three.js** community for the excellent 3D library
- **Rapier.js** for robust physics simulation
- **Freesound.org** for audio assets
- **Mixamo** for character animation rigs
- Built with assistance from **Cursor AI**

## 📞 Support

For questions, bug reports, or feature requests:
- Open an issue on GitHub
- Check the [PRD](docs/PRD.md) for detailed game design
- Review development logs in the `docs/` directory

---

**Happy Racing! 🏎️💥** 