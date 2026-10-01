import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardSelection, createBoardTap } from '../src/board-input.js';

const pointer = (overrides = {}) => ({ pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 100, clientY: 100, ...overrides });
const position = (overrides = {}) => ({
  gameId: 1, fen: 'position-1', phase: 'humanTurn', settings: { playerSide: 'cho' },
  pieces: [{ square: 'a4', side: 'cho' }, { square: 'c4', side: 'cho' }, { square: 'e2', side: 'cho' }, { square: 'a7', side: 'han' }],
  legalMoves: ['a4a5', 'a4a7', 'c4c5', 'e2e2'], ...overrides,
});

test('터치·마우스·펜의 연속 탭은 click이나 화면 갱신을 기다리지 않고 한 번만 이동한다', () => {
  for (const pointerType of ['touch', 'mouse', 'pen']) {
    const taps = createBoardTap(), selection = createBoardSelection(), game = position();
    const actions = [];
    const activate = square => { if (square) actions.push(selection.select(game, square)); };
    for (const [square, x] of [['a4', 100], ['a5', 100]]) {
      const event = pointer({ pointerType, clientX: x });
      taps.down(event, square, true);
      activate(taps.up(event));
    }
    // 두 탭 처리 뒤에 도착하는 브라우저 click은 선택이나 착수를 다시 실행하지 않는다.
    activate(taps.click({ detail: 1 }, 'a4'));
    activate(taps.click({ detail: 2 }, 'a5'));
    activate(taps.click({ detail: 0, nativeEvent: { pointerType } }, 'a4'));
    activate(taps.click({ detail: 0, nativeEvent: { sourceCapabilities: { firesTouchEvents: true } } }, 'a5'));
    assert.deepEqual(actions.map(action => action.selected), ['a4', null]);
    assert.deepEqual(actions.filter(action => action.move).map(action => action.move), ['a4a5']);
  }
});

test('탭의 작은 손 떨림은 허용하고 임의의 시간 지연을 요구하지 않는다', () => {
  const taps = createBoardTap();
  taps.down(pointer(), 'a4', true);
  taps.move(pointer({ clientX: 106, clientY: 108 }));
  assert.equal(taps.up(pointer({ clientX: 106, clientY: 108 })), 'a4');
  assert.equal(taps.up(pointer()), null);
});

test('스크롤·드래그는 시작 위치로 돌아와도 탭으로 처리하지 않는다', () => {
  const taps = createBoardTap();
  taps.down(pointer(), 'a4', true);
  taps.move(pointer({ clientY: 125 }));
  assert.equal(taps.up(pointer()), null);
  assert.equal(taps.click({ detail: 1 }, 'a4'), null);
  taps.down(pointer(), 'a4', true);
  assert.equal(taps.up(pointer({ clientX: 120 })), null);
});

test('취소·포인터 캡처 해제·국면 변경 후 남은 이벤트로 착수하지 않는다', () => {
  for (const reset of ['cancel', 'reset']) {
    const taps = createBoardTap();
    taps.down(pointer(), 'a4', true);taps[reset](pointer());
    assert.equal(taps.up(pointer()), null);
    assert.equal(taps.click({ detail: 1 }, 'a4'), null);
    taps.down(pointer({ pointerId: 2 }), 'c4', true);
    assert.equal(taps.up(pointer({ pointerId: 2 })), 'c4');
  }
});

test('두 손가락 확대는 두 포인터 모두 착수하지 않고 이후 일반 탭은 허용한다', () => {
  const taps = createBoardTap(), first = pointer(), second = pointer({ pointerId: 2, isPrimary: false });
  taps.down(first, 'a4', true);taps.down(second, 'c4', true);
  assert.equal(taps.up(second), null);assert.equal(taps.up(first), null);
  taps.down(pointer({ pointerId: 3 }), 'a4', true);
  assert.equal(taps.up(pointer({ pointerId: 3 })), 'a4');
});

test('오른쪽 버튼·보조 포인터·비활성 판·칸 바깥·누르지 않은 포인터는 무시한다', () => {
  for (const [event, square, enabled] of [
    [pointer({ button: 2 }), 'a4', true], [pointer({ isPrimary: false }), 'a4', true],
    [pointer(), 'a4', false], [pointer(), undefined, true],
  ]) {
    const taps = createBoardTap();taps.down(event, square, enabled);
    assert.equal(taps.up(event), null);
  }
  assert.equal(createBoardTap().up(pointer()), null);
});

test('키보드·보조 기술의 click은 탭 이후에도 허용한다', () => {
  const taps = createBoardTap();taps.down(pointer(), 'a4', true);taps.up(pointer());
  assert.equal(taps.click({ detail: 0 }, 'c4'), 'c4');
  assert.equal(taps.click({ detail: 0, nativeEvent: { pointerType: '' } }, 'c4'), 'c4');
});

test('동일한 말 재선택·아군 변경·불법 목적지·잡기·한수쉼을 정확히 구분한다', () => {
  const selection = createBoardSelection(), game = position();
  assert.equal(selection.select(game, 'a4').selected, 'a4');
  assert.equal(selection.select(game, 'a4').selected, null);
  selection.select(game, 'a4');assert.equal(selection.select(game, 'c4').selected, 'c4');
  assert.equal(selection.select(game, 'c5').move, 'c4c5');
  selection.select(game, 'a4');const illegal = selection.select(game, 'b5');
  assert.equal(illegal.selected, null);assert.equal(illegal.move, null);assert.ok(illegal.message);
  selection.select(game, 'a4');assert.equal(selection.select(game, 'a7').move, 'a4a7');
  selection.select(game, 'e2');const deselect = selection.select(game, 'e2');
  assert.equal(deselect.selected, null);assert.equal(deselect.move, null);
});

test('이전 국면·새 대국·차례 변경·선택 초기화 이후 선택을 다음 착수에 사용하지 않는다', () => {
  for (const overrides of [{ fen: 'position-2' }, { gameId: 2 }, { phase: 'aiThinking' }, { phase: 'restoring' }, { phase: 'applyingMove' }, { phase: 'finished' }]) {
    const selection = createBoardSelection();selection.select(position(), 'a4');
    const result = selection.select(position(overrides), 'a5');
    assert.equal(result.move, null);assert.equal(result.selected, null);
  }
  const selection = createBoardSelection();selection.select(position(), 'a4');selection.reset();
  assert.equal(selection.select(position(), 'a5').move, null);
});
