import {Router} from 'express';
import {pool} from '../config/db.js';

const router=Router();

router.get('/', async (req,res,next)=>{
  try {
    await pool.query('SELECT 1');
    res.json({status:'ok',service:'chess-platform-backend'});
  } catch(error) { next(error); }
});

export default router;
