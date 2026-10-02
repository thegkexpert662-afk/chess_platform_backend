export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function isValidUciMove(move) {
  return typeof move === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move);
}
