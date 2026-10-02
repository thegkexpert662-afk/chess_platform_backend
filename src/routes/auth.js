import { Router } from 'express';
import { z } from 'zod';
import { registerUser, loginUser } from '../auth/auth-service.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128)
});
const loginSchema = z.object({
  login: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(128)
});

router.post('/register', async (req,res,next)=>{
  try {
    const data = registerSchema.parse(req.body);
    const result = await registerUser(data);
    res.status(201).json(result);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({error:{code:'USER_EXISTS',message:'Username or email already exists'}});
    if (error.name === 'ZodError') return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'Invalid registration data',details:error.issues}});
    next(error);
  }
});

router.post('/login', async (req,res,next)=>{
  try {
    const data = loginSchema.parse(req.body);
    res.json(await loginUser(data));
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'Invalid login data',details:error.issues}});
    next(error);
  }
});

router.get('/me', requireAuth, async (req,res,next)=>{
  try {
    const result = await import('../config/db.js').then(({pool}) => pool.query(
      'SELECT id,username,email,role,rating,created_at FROM users WHERE id=$1',[req.user.sub]
    ));
    if (!result.rowCount) return res.status(404).json({error:{code:'USER_NOT_FOUND',message:'User not found'}});
    res.json({user:result.rows[0]});
  } catch(error){ next(error); }
});

export default router;
