import { Chess } from 'chess.js';

export function createGame(fen) {
  return fen ? new Chess(fen) : new Chess();
}

export function applyMove(fen, move) {
  const chess = createGame(fen);
  const result = chess.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion
  });

  return {
    move: result,
    fen: chess.fen(),
    pgn: chess.pgn(),
    status: chess.isCheckmate()
      ? 'checkmate'
      : chess.isStalemate()
        ? 'stalemate'
        : chess.isDraw()
          ? 'draw'
          : chess.isCheck()
            ? 'check'
            : 'active',
    nextTurn: chess.turn() === 'w' ? 'white' : 'black'
  };
}

export function boardState(fen) {
  const chess = createGame(fen);
  return {
    fen: chess.fen(),
    board: chess.board(),
    turn: chess.turn() === 'w' ? 'white' : 'black',
    isCheck: chess.isCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    pgn: chess.pgn()
  };
}
