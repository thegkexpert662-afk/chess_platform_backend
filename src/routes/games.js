import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { START_FEN } from '../game/position.js';
import { applyMove, boardState } from '../game/chess-service.js';
import { parseTimeControl, remainingMs } from '../game/time-control.js';
import { broadcastGame } from '../realtime/game-hub.js';

const router = Router();

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const timeControl = typeof req.body?.timeControl === 'string'
      ? req.body.timeControl : '600+0';

    const result = await pool.query(
      'INSERT INTO games (white_player_id,status,time_control,position_fen,white_time_ms,black_time_ms) VALUES ($1,$2,$3,$4,$5,$5) RETURNING id,status,time_control,position_fen,created_at',
      [req.user.sub, 'waiting', timeControl, START_FEN, parseTimeControl(timeControl).baseMs]
    );
    res.status(201).json({game: result.rows[0]});
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req,res,next) => {
  try {
    const result = await pool.query(
      'SELECT id,white_player_id,black_player_id,status,next_turn,time_control,position_fen,result,white_time_ms,black_time_ms,turn_started_at,created_at,updated_at FROM games WHERE id=$1',
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({error:{code:'GAME_NOT_FOUND',message:'Game not found'}});
    const game=result.rows[0];
    if (game.white_player_id !== req.user.sub && game.black_player_id !== req.user.sub) {
      return res.status(403).json({error:{code:'FORBIDDEN',message:'Not a player in this game'}});
    }
    const latestMove = await pool.query(
      'SELECT move_uci, created_at FROM game_moves WHERE game_id=$1 ORDER BY ply DESC LIMIT 1',
      [game.id]
    );
    const clock=remainingMs(game);
    res.json({
      game:{...game,white_time_ms:clock.whiteMs,black_time_ms:clock.blackMs},
      position:boardState(game.position_fen),
      lastMove: latestMove.rows[0] ?? null
    });
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

    const clock=remainingMs(game);
    const turnMs=game.next_turn==='white'?clock.whiteMs:clock.blackMs;
    if(turnMs<=0){
      const timeoutResult=game.next_turn==='white'?'black_win':'white_win';
      await client.query('UPDATE games SET status=$1,result=$2,updated_at=NOW() WHERE id=$3',['finished',timeoutResult,game.id]);
      await client.query('COMMIT');
      broadcastGame(game.id,{type:'game_finished',result:timeoutResult});
      return res.status(409).json({error:{code:'TIMEOUT',message:'Time expired'},result:timeoutResult});
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
    const resultValue=result.status==='checkmate' ? (game.next_turn==='white'?'white_win':'black_win') : (status==='finished'?result.status:null);
    const tc=parseTimeControl(game.time_control);
    const afterMoveMs=Math.max(0,turnMs+tc.incrementMs);
    const whiteMs=game.next_turn==='white'?afterMoveMs:clock.whiteMs;
    const blackMs=game.next_turn==='black'?afterMoveMs:clock.blackMs;

    await client.query(
      'UPDATE games SET position_fen=$1,next_turn=$2,status=$3,result=$4,white_time_ms=$5,black_time_ms=$6,turn_started_at=CASE WHEN $3::varchar = \'active\' THEN NOW() ELSE turn_started_at END,updated_at=NOW() WHERE id=$7',
      [result.fen,result.nextTurn,status,resultValue,whiteMs,blackMs,game.id]
    );

    await client.query('COMMIT');
    const payload={type:'game_update',gameId:game.id,position:boardState(result.fen),gameStatus:result.status,result:resultValue};
    broadcastGame(game.id,payload);
    res.status(201).json({move:move.rows[0],position:payload.position,gameStatus:result.status,result:resultValue,game:{id:game.id,status,result:resultValue,next_turn:result.nextTurn,white_player_id:game.white_player_id,black_player_id:game.black_player_id}});
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>{});
    next(error);
  } finally {
    client.release();
  }
});

export default router;
