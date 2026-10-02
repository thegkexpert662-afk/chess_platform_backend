import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const wss = new WebSocketServer({ noServer: true });
const clients = new Map();

export function attachRealtime(server) {
  server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws));
  });

  wss.on('connection', ws => {
    ws.once('message', raw => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type !== 'auth') throw new Error('auth required');
        const user = jwt.verify(message.token, env.jwtSecret, { issuer: 'chess-platform' });
        ws.userId = user.sub;
        ws.gameId = message.gameId;
        if (!ws.gameId) throw new Error('gameId required');

        if (!clients.has(ws.gameId)) clients.set(ws.gameId, new Set());
        clients.get(ws.gameId).add(ws);
        ws.send(JSON.stringify({ type: 'connected', gameId: ws.gameId }));

        ws.on('close', () => {
          clients.get(ws.gameId)?.delete(ws);
          if (clients.get(ws.gameId)?.size === 0) clients.delete(ws.gameId);
        });
      } catch {
        ws.close(1008, 'Unauthorized');
      }
    });
  });
}

export function broadcastGame(gameId, payload) {
  const peers = clients.get(gameId);
  if (!peers) return;
  const message = JSON.stringify(payload);
  for (const ws of peers) {
    if (ws.readyState === 1) ws.send(message);
  }
}
