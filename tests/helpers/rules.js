import createRules from '../../public/engine/ffish.js';
export const ffish = await createRules();
ffish.loadVariantConfig('');
export function fixture(pieces, turn = 'w') {
  const rows = Array.from({ length: 10 }, () => Array(9).fill(''));
  for (const [square, char] of Object.entries(pieces)) rows[10 - Number(square.slice(1))][square.charCodeAt(0) - 97] = char;
  return rows.map(row => row.map(c => c || '1').join('').replace(/1+/g, s => s.length)).join('/') + ` ${turn} - - 0 1`;
}
export function withBoard(fen, callback, variant = 'feents-b0-m0-r0') {
  const board = new ffish.Board(variant, fen);
  try { return callback(board); } finally { board.delete(); }
}
export const moves = board => board.legalMoves().split(' ').filter(Boolean);
