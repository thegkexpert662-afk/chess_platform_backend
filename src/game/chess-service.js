import { Chess } from 'chess.js';

function squareName(row, col) {
  return String.fromCharCode(97 + col) + (8 - row).toString();
}

function kingAndAttackers(chess) {
  const board = chess.board();
  const kingColor = chess.turn();
  const attackerColor = kingColor === 'w' ? 'b' : 'w';
  let kingSquare = null;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece?.type === 'k' && piece.color === kingColor) {
        kingSquare = squareName(row, col);
        break;
      }
    }
    if (kingSquare) break;
  }

  const checkingSquares = kingSquare
    ? chess.attackers(kingSquare, attackerColor)
    : [];

  return { kingSquare, checkingSquares };
}

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

  const status = chess.isCheckmate()
    ? 'checkmate'
    : chess.isStalemate()
      ? 'stalemate'
      : chess.isDraw()
        ? 'draw'
        : chess.isCheck()
          ? 'check'
          : 'active';

  const checkInfo = status === 'check' || status === 'checkmate'
    ? kingAndAttackers(chess)
    : { kingSquare: null, checkingSquares: [] };

  return {
    move: result,
    fen: chess.fen(),
    pgn: chess.pgn(),
    status,
    kingSquare: checkInfo.kingSquare,
    checkingSquares: checkInfo.checkingSquares,
    nextTurn: chess.turn() === 'w' ? 'white' : 'black'
  };
}

export function boardState(fen) {
  const chess = createGame(fen);
  const isCheck = chess.isCheck();
  const isCheckmate = chess.isCheckmate();
  const status = isCheckmate
    ? 'checkmate'
    : chess.isStalemate()
      ? 'stalemate'
      : chess.isDraw()
        ? 'draw'
        : isCheck
          ? 'check'
          : 'active';
  const checkInfo = isCheck
    ? kingAndAttackers(chess)
    : { kingSquare: null, checkingSquares: [] };

  return {
    fen: chess.fen(),
    board: chess.board(),
    turn: chess.turn() === 'w' ? 'white' : 'black',
    isCheck,
    isCheckmate,
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    status,
    kingSquare: checkInfo.kingSquare,
    checkingSquares: checkInfo.checkingSquares,
    pgn: chess.pgn()
  };
}