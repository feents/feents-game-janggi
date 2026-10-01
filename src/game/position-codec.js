import { createInitialPosition, pieceName } from '../board-position.js';

const TYPES = { k: 'general', a: 'guard', r: 'chariot', n: 'horse', b: 'elephant', c: 'cannon', p: 'soldier' };
const CHARS = Object.fromEntries(Object.entries(TYPES).map(([char, type]) => [type, char]));

export function rulesVariant(settings) {
  return `feents-b${Number(settings.bigjang)}-m${Number(settings.materialVictory)}-r${Number(settings.repetitionLimit)}`;
}

export function screenToSquare(column, row, playerSide) {
  if (playerSide === 'han') [column, row] = [8 - column, 9 - row];
  return `${'abcdefghi'[column]}${10 - row}`;
}

export function squareToScreen(square, playerSide) {
  if (!/^[a-i](10|[1-9])$/.test(square)) throw new Error('잘못된 장기 좌표예요.');
  const column = 'abcdefghi'.indexOf(square[0]);
  const row = 10 - Number(square.slice(1));
  return playerSide === 'han' ? { column: 8 - column, row: 9 - row } : { column, row };
}

export function parseMove(move) {
  const match = /^([a-i](?:10|[1-9]))([a-i](?:10|[1-9]))$/.exec(move);
  if (!match) throw new Error('엔진의 착수 좌표를 읽을 수 없어요.');
  return { from: match[1], to: match[2], pass: match[1] === match[2] };
}

export function initialFen(settings) {
  const rows = Array.from({ length: 10 }, () => Array(9).fill(''));
  for (const piece of createInitialPosition(settings)) {
    const square = screenToSquare(piece.column, piece.row, settings.playerSide);
    const { column, row } = squareToScreen(square, 'cho');
    rows[row][column] = piece.side === 'cho' ? CHARS[piece.type].toUpperCase() : CHARS[piece.type];
  }
  const placement = rows.map((row) => {
    let out = '', empty = 0;
    for (const char of [...row, '#']) {
      if (!char) empty++;
      else { if (empty) out += empty; empty = 0; if (char !== '#') out += char; }
    }
    return out;
  }).join('/');
  return `${placement} w - - 0 1`;
}

export function piecesFromFen(fen, playerSide) {
  const pieces = [];
  fen.split(' ')[0].split('/').forEach((line, row) => {
    let column = 0;
    for (const char of line) {
      if (/\d/.test(char)) column += Number(char);
      else {
        const type = TYPES[char.toLowerCase()];
        if (!type) throw new Error('알 수 없는 장기말이에요.');
        const side = char === char.toUpperCase() ? 'cho' : 'han';
        const square = screenToSquare(column, row, 'cho');
        pieces.push({ id: square, square, side, type, owner: side === playerSide ? 'player' : 'ai', ...squareToScreen(square, playerSide) });
        column++;
      }
    }
    if (column !== 9) throw new Error('장기판의 열 수가 올바르지 않아요.');
  });
  return pieces;
}

export function moveRecord(move, pieces, side) {
  const { from, to, pass } = parseMove(move);
  if (pass) return { move, side, label: '한수쉼', capture: false };
  const piece = pieces.find((item) => item.square === from);
  const target = pieces.find((item) => item.square === to);
  return { move, side, label: `${pieceName(piece)} ${from} → ${to}${target ? ` · ${pieceName(target)} 잡음` : ''}`, capture: Boolean(target) };
}
