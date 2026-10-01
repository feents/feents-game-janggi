import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialPosition } from '../src/board-position.js';
import { calculateMaterialScores } from '../src/material-score.js';
import { FORMATIONS, INITIAL_SETTINGS } from '../src/settings.js';

test('진영과 양쪽 상차림을 바꿔도 시작 점수는 초 72점, 한 73.5점이다', () => {
  for (const playerSide of ['cho', 'han']) {
    for (const playerFormation of FORMATIONS) {
      for (const aiFormation of FORMATIONS) {
        const pieces = createInitialPosition({ ...INITIAL_SETTINGS, playerSide, playerFormation, aiFormation });
        assert.deepEqual(calculateMaterialScores(pieces), {
          cho: { material: 72, bonus: 0, total: 72 },
          han: { material: 72, bonus: 1.5, total: 73.5 },
        });
      }
    }
  }
});

test('잡힌 말을 제외한 현재 배치에서 양쪽 점수를 다시 계산한다', () => {
  const pieces = createInitialPosition(INITIAL_SETTINGS);
  const captured = new Set([
    pieces.find((p) => p.side === 'cho' && p.type === 'chariot').id,
    pieces.find((p) => p.side === 'han' && p.type === 'cannon').id,
    pieces.find((p) => p.side === 'han' && p.type === 'soldier').id,
  ]);
  const remaining = pieces.filter((p) => !captured.has(p.id));
  assert.deepEqual(calculateMaterialScores(remaining), {
    cho: { material: 59, bonus: 0, total: 59 },
    han: { material: 63, bonus: 1.5, total: 64.5 },
  });
  assert.equal(pieces.length, 32);
});

test('마·상·사·졸의 점수를 구분하며 궁은 점수에서 제외한다', () => {
  const pieces = [
    { side: 'cho', type: 'general' },
    { side: 'cho', type: 'horse' },
    { side: 'cho', type: 'elephant' },
    { side: 'han', type: 'general' },
    { side: 'han', type: 'guard' },
    { side: 'han', type: 'soldier' },
  ];
  assert.deepEqual(calculateMaterialScores(pieces), {
    cho: { material: 8, bonus: 0, total: 8 },
    han: { material: 5, bonus: 1.5, total: 6.5 },
  });
});

test('점수에 포함되는 기물이 없어도 한나라 덤은 한 번만 더한다', () => {
  assert.deepEqual(calculateMaterialScores([
    { side: 'cho', type: 'general' },
    { side: 'han', type: 'general' },
  ]), {
    cho: { material: 0, bonus: 0, total: 0 },
    han: { material: 0, bonus: 1.5, total: 1.5 },
  });
});
