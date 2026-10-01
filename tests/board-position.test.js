import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialPosition, pieceGlyph } from '../src/board-position.js';
import { INITIAL_SETTINGS } from '../src/settings.js';

// 각 상차림을 실제 화면의 왼쪽→오른쪽 순서로 명시한 독립 기준값.
const formations = [
  { name: '마상상마', player: 'HEEH', ai: 'HEEH' },
  { name: '상마마상', player: 'EHHE', ai: 'EHHE' },
  { name: '마상마상', player: 'HEHE', ai: 'EHEH' },
  { name: '상마상마', player: 'EHEH', ai: 'HEHE' },
];

function formationOnScreen(pieces, owner) {
  return pieces.filter((piece) => piece.owner === owner && ['horse', 'elephant'].includes(piece.type))
    .sort((a, b) => a.column - b.column)
    .map((piece) => piece.type === 'horse' ? 'H' : 'E').join('');
}

for (const side of ['cho', 'han']) {
  for (const player of formations) {
    for (const ai of formations) {
      test(`${side}: 사용자 ${player.name} / AI ${ai.name} 배치`, () => {
        const settings = Object.freeze({ ...INITIAL_SETTINGS, playerSide: side, playerFormation: player.name, aiFormation: ai.name });
        const pieces = createInitialPosition(settings);
        assert.equal(pieces.length, 32);
        assert.equal(new Set(pieces.map((piece) => `${piece.column},${piece.row}`)).size, 32);
        assert.equal(new Set(pieces.map((piece) => piece.id)).size, 32);
        assert.equal(formationOnScreen(pieces, 'player'), player.player);
        assert.equal(formationOnScreen(pieces, 'ai'), ai.ai);
        for (const owner of ['player', 'ai']) {
          const army = pieces.filter((piece) => piece.owner === owner);
          assert.equal(army.length, 16);
          const expectedSide = owner === 'player' ? side : (side === 'cho' ? 'han' : 'cho');
          assert.ok(army.every((piece) => piece.side === expectedSide));
          assert.deepEqual(Object.fromEntries(['general', 'guard', 'chariot', 'horse', 'elephant', 'cannon', 'soldier']
            .map((type) => [type, army.filter((piece) => piece.type === type).length])),
          { general: 1, guard: 2, chariot: 2, horse: 2, elephant: 2, cannon: 2, soldier: 5 });
          assert.ok(army.every((piece) => piece.column >= 0 && piece.column <= 8 && piece.row >= 0 && piece.row <= 9));
          assert.ok(army.every((piece) => owner === 'player' ? piece.row >= 6 : piece.row <= 3));
        }
      });
    }
  }
}

test('기본 상차림의 궁·사·차·포·졸/병은 정확한 교차점에 놓인다', () => {
  const position = createInitialPosition(INITIAL_SETTINGS);
  const rows = Array.from({ length: 10 }, () => Array(9).fill('.'));
  const notation = { general: 'K', guard: 'A', chariot: 'R', horse: 'H', elephant: 'E', cannon: 'C', soldier: 'P' };
  for (const piece of position) rows[piece.row][piece.column] = notation[piece.type];
  assert.deepEqual(rows.map((row) => row.join('')), [
    'REHA.AEHR',
    '....K....',
    '.C.....C.',
    'P.P.P.P.P',
    '.........',
    '.........',
    'P.P.P.P.P',
    '.C.....C.',
    '....K....',
    'REHA.AEHR',
  ]);
});

test('초·한 선택을 바꿔도 아래쪽 사용자와 위쪽 AI를 유지한다', () => {
  const pieces = createInitialPosition({ ...INITIAL_SETTINGS, playerSide: 'han' });
  const glyphAt = (column, row) => pieceGlyph(pieces.find((piece) => piece.column === column && piece.row === row));
  assert.equal(glyphAt(4, 1), '楚');
  assert.equal(glyphAt(4, 8), '漢');
  assert.equal(glyphAt(0, 3), '卒');
  assert.equal(glyphAt(0, 6), '兵');
});
