import { parseMove, piecesFromFen } from './position-codec.js';

// 칸이 바뀌어도 말의 ID를 유지한다. 회수·무르기·복기는 같은 말을 참조한다.
export function advancePosition(previous, position, move, playerSide) {
  const { from, to, pass } = parseMove(move);
  const moving = previous.pieces.find(piece => piece.square === from);
  const target = pass ? null : previous.pieces.find(piece => piece.square === to);
  const pieces = piecesFromFen(position.fen, playerSide).map(piece => {
    const oldSquare = !pass && piece.square === to ? from : piece.square;
    const old = previous.pieces.find(item => item.square === oldSquare);
    return { ...piece, id: old?.id ?? piece.id };
  });
  const captured = target
    ? [...previous.captured, { ...target, capturedBy: moving.side }]
    : previous.captured;
  return { ...position, pieces, captured };
}

export function historySnapshot(position, clocks, lastMove = null) {
  return { fen: position.fen, pieces: position.pieces, captured: position.captured,
    turn: position.turn, check: position.check, bikjang: position.bikjang,
    clocks: structuredClone(clocks), lastMove };
}
