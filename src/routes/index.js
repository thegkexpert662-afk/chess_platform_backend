import {Router} from 'express';
import health from './health.js';
import games from './games.js';
import auth from './auth.js';
import users from './users.js';
import matchmaking from './matchmaking.js';
import history from './history.js';
import dashboard from './dashboard.js';

const router=Router();
router.use('/health',health);
router.use('/auth',auth);
router.use('/users',users);
router.use('/games',games);
router.use('/matchmaking',matchmaking);
router.use('/history',history);
router.use('/dashboard',dashboard);

export default router;
