import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { START_FEN } from '../game/position.js';
import { applyMove, boardState } from '../game/chess-service.js';
import { parseTimeControl, remainingMs } from '../game/time-control.js';

const router = Router();

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const timeControl = typeof req.body?.timeControl === 'string'
      ? req.body.timeControl : '600+0';

    const result = await pool.query(
      'INSERT INTO games (white_player_id,status,time_control,position_fen) VALUES ($1,$2,$3,$4) RETURNING id,status,time_control,position_fen,created_at',
      [req.user.sub, 'waiting', timeControl, START_FEN]
    );
    res.status(201).json({game: result.rows[0]});
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req,res,next) => {
  try {
    const result = await pool.query(
      'SELECT id,white_player_id,black_player_id,status,next_turn,time_control,position_fen,result,created_at,updated_at FROM games WHERE id=$1',
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({error:{code:'GAME_NOT_FOUND',message:'Game not found'}});
    const game=result.rows[0];
    if (game.white_player_id !== req.user.sub && game.black_player_id !== req.user.sub) {
      return res.status(403).json({error:{code:'FORBIDDEN',message:'Not a player in this game'}});
    }
    res.json({game,position:boardState(game.position_fen)});
  } catch(error) { next(error); }
});

router.post('/:id/moves', requireAuth, async (req,res,next) => {
  const client=await pool.connect();
  try {
    const {from,to,promotion}=req.body || {};
    if (!/^[a-h][1-8]$/.test(from || '') || !/^[a-h][1-8]$/.test(to || '')) {
      return res.status(400).json({error:{code:'INVALID_MOVE',message:'from and to squares are required'}});
    }
    if (promotion && !/^[qrbn]$/.test(promotion)) {
      return res.status(400).json({error:{code:'INVALID_PROMOTION',message:'Invalid promotion piece'}});
    }

    await client.query('BEGIN');
    const locked=await client.query('SELECT * FROM games WHERE id=$1 FOR UPDATE',[req.params.id]);
    if (!locked.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({error:{code:'GAME_NOT_FOUND',message:'Game not found'}});
    }

    const game=locked.rows[0];
    if (game.white_player_id !== req.user.sub && game.black_player_id !== req.user.sub) {
      await client.query('ROLLBACK');
      return res.status(403).json({error:{code:'FORBIDDEN',message:'Not a player in this game'}});
    }
    if (game.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'GAME_NOT_ACTIVE',message:'Game is not active'}});
    }

    const expectedPlayer=game.next_turn === 'white' ? game.white_player_id : game.black_player_id;
    if (expectedPlayer !== req.user.sub) {
      await client.query('ROLLBACK');
      return res.status(409).json({error:{code:'NOT_YOUR_TURN',message:'It is not your turn'}});
    }

    let result;
    try {
      result=applyMove(game.position_fen,{from,to,promotion});
    } catch {
      await client.query('ROLLBACK');
      return res.status(400).json({error:{code:'ILLEGAL_MOVE',message:'Illegal chess move'}});
    }

    const move=await client.query(
      'INSERT INTO game_moves (game_id,ply,player_id,move_uci,position_fen) VALUES ($1,COALESCE((SELECT MAX(ply)+1 FROM game_moves WHERE game_id=$1),1),$2,$3,$4) RETURNING id,ply,move_uci,position_fen,created_at',
      [game.id,req.user.sub,from+to+(promotion || ''),result.fen]
    );

    const status=result.status === 'active' || result.status === 'check' ? 'active' : 'finished';
    await client.query(
      'UPDATE games SET position_fen=$1,next_turn=$2,status=$3,result=$4,updated_at=NOW() WHERE id=$5',
      [result.fen,result.nextTurn,status,result.status === 'check' ? null : result.status,game.id]
    );

    await client.query('COMMIT');
    res.status(201).json({move:move.rows[0],position:boardState(result.fen),gameStatus:result.status});
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>{});
    next(error);
  } finally {
    client.release();
  }
});

export default router;
