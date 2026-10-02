import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';

const router=Router();

router.get('/profile', requireAuth, async (req,res,next)=>{
  try {
    const result=await pool.query(
      'SELECT id,username,email,role,rating,created_at FROM users WHERE id=$1',[req.user.sub]
    );
    if(!result.rowCount) return res.status(404).json({error:{code:'USER_NOT_FOUND',message:'User not found'}});
    res.json({user:result.rows[0]});
  } catch(error){next(error);}
});

export default router;
