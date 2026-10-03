import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.sub;

    await pool.query(
      'INSERT INTO user_wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );

    const userResult = await pool.query(
      'SELECT id, username, email, role, rating, created_at FROM users WHERE id=$1',
      [userId]
    );
    if (!userResult.rowCount) {
      return res.status(404).json({error:{code:'USER_NOT_FOUND',message:'User not found'}});
    }

    const statsResult = await pool.query(
      'SELECT COUNT(*)::int AS games, ' +
      "COUNT(*) FILTER (WHERE (g.white_player_id=$1 AND g.result='white_win') OR (g.black_player_id=$1 AND g.result='black_win'))::int AS wins, " +
      "COUNT(*) FILTER (WHERE (g.white_player_id=$1 AND g.result='black_win') OR (g.black_player_id=$1 AND g.result='white_win'))::int AS losses, " +
      "COUNT(*) FILTER (WHERE g.result IN ('draw','stalemate'))::int AS draws " +
      'FROM games g WHERE g.white_player_id=$1 OR g.black_player_id=$1',
      [userId]
    );

    const walletResult = await pool.query(
      'SELECT coin_balance FROM user_wallets WHERE user_id=$1',
      [userId]
    );

    const gamesResult = await pool.query(
      'SELECT g.id,g.status,g.result,g.time_control,g.created_at,g.updated_at,' +
      ' wu.username AS white_username, bu.username AS black_username ' +
      'FROM games g LEFT JOIN users wu ON wu.id=g.white_player_id LEFT JOIN users bu ON bu.id=g.black_player_id ' +
      'WHERE g.white_player_id=$1 OR g.black_player_id=$1 ORDER BY g.updated_at DESC LIMIT 5',
      [userId]
    );

    const leaderboardResult = await pool.query(
      "SELECT id,username,rating FROM users WHERE role='player' ORDER BY rating DESC, created_at ASC LIMIT 10"
    );

    const notificationResult = await pool.query(
      'SELECT id,title,message,type,is_read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );

    const tournamentsResult = await pool.query(
      'SELECT t.id,t.name,t.description,t.status,t.start_at,t.end_at,t.max_players,t.entry_coins,t.prize_coins,' +
      ' COUNT(tp.user_id)::int AS players, ' +
      ' EXISTS(SELECT 1 FROM tournament_players mine WHERE mine.tournament_id=t.id AND mine.user_id=$1) AS joined ' +
      'FROM tournaments t LEFT JOIN tournament_players tp ON tp.tournament_id=t.id ' +
      "WHERE t.status IN ('upcoming','live') GROUP BY t.id ORDER BY t.start_at ASC LIMIT 10",
      [userId]
    );

    res.json({
      user: userResult.rows[0],
      stats: statsResult.rows[0],
      wallet: walletResult.rows[0] ?? {coin_balance: 0},
      recentGames: gamesResult.rows,
      leaderboard: leaderboardResult.rows,
      notifications: notificationResult.rows,
      tournaments: tournamentsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/coins', requireAuth, async (req,res,next)=>{
  try {
    await pool.query('INSERT INTO user_wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',[req.user.sub]);
    const wallet=await pool.query('SELECT coin_balance,updated_at FROM user_wallets WHERE user_id=$1',[req.user.sub]);
    const transactions=await pool.query(
      'SELECT id,amount,reason,created_at FROM coin_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.user.sub]
    );
    res.json({wallet:wallet.rows[0],transactions:transactions.rows});
  } catch(error){next(error);}
});

router.get('/notifications', requireAuth, async (req,res,next)=>{
  try {
    const result=await pool.query(
      'SELECT id,title,message,type,is_read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [req.user.sub]
    );
    res.json({notifications:result.rows});
  } catch(error){next(error);}
});

router.get('/tournaments', requireAuth, async (req,res,next)=>{
  try {
    const result=await pool.query(
      'SELECT t.id,t.name,t.description,t.status,t.start_at,t.end_at,t.max_players,t.entry_coins,t.prize_coins,' +
      ' COUNT(tp.user_id)::int AS players, ' +
      ' EXISTS(SELECT 1 FROM tournament_players mine WHERE mine.tournament_id=t.id AND mine.user_id=$1) AS joined ' +
      'FROM tournaments t LEFT JOIN tournament_players tp ON tp.tournament_id=t.id ' +
      'GROUP BY t.id ORDER BY t.start_at ASC',
      [req.user.sub]
    );
    res.json({tournaments:result.rows});
  } catch(error){next(error);}
});

router.get('/settings', requireAuth, async (req,res,next)=>{
  try {
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',[req.user.sub]);
    const result=await pool.query(
      'SELECT sound_enabled,notifications_enabled,board_theme,piece_style FROM user_settings WHERE user_id=$1',
      [req.user.sub]
    );
    res.json({settings:result.rows[0]});
  } catch(error){next(error);}
});

export default router;
