import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { parseTimeControl } from '../game/time-control.js';

const router=Router();

router.post('/join', requireAuth, async (req,res,next)=>{
  const client=await pool.connect();
  try {
    const {timeControl='600+0'}=req.body||{};
    parseTimeControl(timeControl);
    await client.query('BEGIN');
    const waiting=await client.query(
      'SELECT * FROM games WHERE status=$1 AND time_control=$2 AND white_player_id<>$3 AND black_player_id IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED',
      ['waiting',timeControl,req.user.sub]
    );
    if(waiting.rowCount){
      const game=waiting.rows[0];
      const tc=parseTimeControl(timeControl);
      await client.query(
        'UPDATE games SET black_player_id=$1,status=$2,white_time_ms=$3,black_time_ms=$3,turn_started_at=NOW(),updated_at=NOW() WHERE id=$4',
        [req.user.sub,'active',tc.baseMs,game.id]
      );
      await client.query('COMMIT');
      return res.json({gameId:game.id,status:'active'});
    }
    const tc=parseTimeControl(timeControl);
    const created=await client.query(
      'INSERT INTO games(white_player_id,status,time_control,position_fen,white_time_ms,black_time_ms) VALUES($1,$2,$3,$4,$5,$5) RETURNING id,status,time_control',
      [req.user.sub,'waiting',timeControl,'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',tc.baseMs]
    );
    await client.query('COMMIT');
    res.status(201).json({gameId:created.rows[0].id,status:'waiting',timeControl});
  }catch(error){await client.query('ROLLBACK').catch(()=>{});next(error);}
  finally{client.release();}
});

router.post('/:id/resign',requireAuth,async(req,res,next)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const locked=await client.query('SELECT * FROM games WHERE id=$1 FOR UPDATE',[req.params.id]);
    if(!locked.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:{code:'GAME_NOT_FOUND',message:'Game not found'}});}
    const game=locked.rows[0];
    if(game.white_player_id!==req.user.sub && game.black_player_id!==req.user.sub){await client.query('ROLLBACK');return res.status(403).json({error:{code:'FORBIDDEN',message:'Not a player'}});}
    if(game.status!=='active'){await client.query('ROLLBACK');return res.status(409).json({error:{code:'GAME_NOT_ACTIVE',message:'Game is not active'}});}
    const result=game.white_player_id===req.user.sub?'black_win':'white_win';
    await client.query('UPDATE games SET status=$1,result=$2,updated_at=NOW() WHERE id=$3',['finished',result,game.id]);
    await client.query('COMMIT');
    res.json({status:'finished',result});
  }catch(error){await client.query('ROLLBACK').catch(()=>{});next(error);}
  finally{client.release();}
});

export default router;
