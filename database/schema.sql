CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'player',
  rating INTEGER NOT NULL DEFAULT 1200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_player_id UUID REFERENCES users(id),
  black_player_id UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  next_turn VARCHAR(5) NOT NULL DEFAULT 'white',
  time_control VARCHAR(20) NOT NULL DEFAULT '600+0',
  position_fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  result VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_moves (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  player_id UUID NOT NULL REFERENCES users(id),
  move_uci VARCHAR(5) NOT NULL,
  position_fen TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, ply)
);

CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_moves_game ON game_moves(game_id,ply);


ALTER TABLE games ADD COLUMN IF NOT EXISTS white_time_ms BIGINT NOT NULL DEFAULT 600000;
ALTER TABLE games ADD COLUMN IF NOT EXISTS black_time_ms BIGINT NOT NULL DEFAULT 600000;
ALTER TABLE games ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS game_events (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES users(id),
  event_type VARCHAR(40) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_games_waiting ON games(status,time_control,created_at);
CREATE INDEX IF NOT EXISTS idx_events_game ON game_events(game_id,created_at);
