import { Server } from 'socket.io';
import { createServer } from 'http';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store connected players
const players = new Map();

io.on('connection', (socket) => {
  console.log('👤 Player connected:', socket.id);
  
  // Add player to the game
  players.set(socket.id, {
    id: socket.id,
    position: { x: 0, y: 2, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }
  });
  
  // Send current players to the new player
  socket.emit('currentPlayers', Array.from(players.values()));
  
  // Notify other players of new player
  socket.broadcast.emit('playerJoined', players.get(socket.id));
  
  // Handle player state updates
  socket.on('playerState', (data) => {
    const player = players.get(socket.id);
    if (player) {
      Object.assign(player, data);
      socket.broadcast.emit('stateUpdate', { id: socket.id, ...data });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('👤 Player disconnected:', socket.id);
    players.delete(socket.id);
    socket.broadcast.emit('playerLeft', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
}); 