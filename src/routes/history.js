import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';

const router=Router();
router.get('/',requireAuth,async(req,res,next)=>{
  try{
    const result=await pool.query(
      `SELECT g.id,g.status,g.result,g.time_control,g.created_at,g.updated_at,
        wu.username AS white_username, bu.username AS black_username
       FROM games g
       LEFT JOIN users wu ON wu.id=g.white_player_id
       LEFT JOIN users bu ON bu.id=g.black_player_id
       WHERE g.white_player_id=$1 OR g.black_player_id=$1
       ORDER BY g.updated_at DESC LIMIT 50`,
      [req.user.sub]
    );
    res.json({games:result.rows});
  }catch(error){next(error);}
});
export default router;
