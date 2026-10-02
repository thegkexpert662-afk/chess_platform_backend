import {Router} from 'express';
import health from './health.js';
import games from './games.js';

const router=Router();
router.use('/health',health);
router.use('/games',games);

export default router;
