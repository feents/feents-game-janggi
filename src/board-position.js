import { oppositeSide } from './settings.js';

const PIECE_NAMES = {
  general: '궁', guard: '사', chariot: '차', horse: '마', elephant: '상', cannon: '포',
};

const PIECE_GLYPHS = {
  guard: '士', chariot: '車', horse: '馬', elephant: '象', cannon: '包',
};

export function pieceName(piece) {
  return piece.type === 'soldier' ? (piece.side === 'cho' ? '졸' : '병') : PIECE_NAMES[piece.type];
}

export function pieceGlyph(piece) {
  if (piece.type === 'general') return piece.side === 'cho' ? '楚' : '漢';
  if (piece.type === 'soldier') return piece.side === 'cho' ? '卒' : '兵';
  return PIECE_GLYPHS[piece.type];
}

function placeArmy(side, formation, owner) {
  // 각 진영이 아래에 앉았을 때의 좌표로 만든 뒤 AI 쪽만 180도 회전한다.
  const pieces = [
    { type: 'general', column: 4, row: 8 },
    { type: 'guard', column: 3, row: 9 },
    { type: 'guard', column: 5, row: 9 },
    { type: 'chariot', column: 0, row: 9 },
    { type: 'chariot', column: 8, row: 9 },
    { type: 'cannon', column: 1, row: 7 },
    { type: 'cannon', column: 7, row: 7 },
    ...[0, 2, 4, 6, 8].map((column) => ({ type: 'soldier', column, row: 6 })),
    ...[1, 2, 6, 7].map((column, index) => ({
      type: formation[index] === '마' ? 'horse' : 'elephant', column, row: 9,
    })),
  ];

  return pieces.map((piece, index) => ({
    ...piece,
    id: `${side}-${index}`,
    side,
    owner,
    column: owner === 'ai' ? 8 - piece.column : piece.column,
    row: owner === 'ai' ? 9 - piece.row : piece.row,
  }));
}

export function createInitialPosition(settings) {
  return [
    ...placeArmy(oppositeSide(settings.playerSide), settings.aiFormation, 'ai'),
    ...placeArmy(settings.playerSide, settings.playerFormation, 'player'),
  ];
}
