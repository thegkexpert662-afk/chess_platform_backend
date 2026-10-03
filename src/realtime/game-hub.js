import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';

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

        ws.on('close', async () => {
          clients.get(ws.gameId)?.delete(ws);
          if (clients.get(ws.gameId)?.size === 0) clients.delete(ws.gameId);

          // Leaving an active online game forfeits the disconnected player's game.
          try {
            const result = await pool.query(
              'SELECT id,white_player_id,black_player_id,status FROM games WHERE id=$1',
              [ws.gameId]
            );
            if (!result.rowCount) return;
            const game = result.rows[0];
            if (game.status !== 'active') return;
            if (game.white_player_id !== ws.userId && game.black_player_id !== ws.userId) return;

            const winner = game.white_player_id === ws.userId ? 'black_win' : 'white_win';
            const updated = await pool.query(
              'UPDATE games SET status=$1,result=$2,updated_at=NOW() WHERE id=$3 AND status=$4 RETURNING id',
              ['finished', winner, game.id, 'active']
            );
            if (updated.rowCount) {
              broadcastGame(game.id,{type:'game_finished',result:winner,reason:'opponent_left'});
            }
          } catch (error) {
            console.error('Failed to handle game disconnect:', error);
          }
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
