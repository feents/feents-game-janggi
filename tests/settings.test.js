import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_SETTINGS, changePlayerSide } from '../src/settings.js';
import { createInitialPosition } from '../src/board-position.js';

function armyFormation(pieces, side) {
  const army = pieces.filter(piece => piece.side === side && ['horse', 'elephant'].includes(piece.type));
  const player = army[0].owner === 'player';
  army.sort((a, b) => player ? a.column - b.column : b.column - a.column);
  return army.map(piece => piece.type === 'horse' ? '마' : '상').join('');
}

test('초·한 어느 진영을 선택해도 각 나라의 기본 상차림으로 실제 판이 차려진다', () => {
  for (const side of ['cho', 'han']) {
    const settings = changePlayerSide(INITIAL_SETTINGS, side);
    const pieces = createInitialPosition(settings);
    assert.equal(armyFormation(pieces, 'cho'), '상마상마');
    assert.equal(armyFormation(pieces, 'han'), '마상마상');
    assert.equal(settings.minutes, 5);
  }
});

test('진영 교체·되돌리기는 사용자가 바꾼 각 나라 상차림과 나머지 설정을 보존한다', () => {
  const custom = Object.freeze({ ...INITIAL_SETTINGS, playerFormation: '상마마상', aiFormation: '마상상마', minutes: 15 });
  const han = changePlayerSide(custom, 'han');
  assert.equal(han.playerFormation, '마상상마');
  assert.equal(han.aiFormation, '상마마상');
  assert.equal(han.minutes, 15);
  assert.deepEqual(changePlayerSide(han, 'cho'), custom);
  assert.equal(changePlayerSide(custom, 'cho'), custom);
});
