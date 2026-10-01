import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SETTINGS as defaults, FORMATIONS, AI_LEVELS } from '../src/settings.js';
import { initialFen, piecesFromFen, screenToSquare, squareToScreen, parseMove } from '../src/game/position-codec.js';
import { createClocks, consumeTime, completeTurn, availableTime, formatClock } from '../src/game/clock.js';
import { difficultyProfile } from '../src/engine/difficulty.js';
import { createInitialPosition } from '../src/board-position.js';

test('초·한 좌표와 10행 착수는 서로 정확히 변환된다', () => {
  for (const side of ['cho','han']) for (let row=0;row<10;row++) for(let column=0;column<9;column++) {
    assert.deepEqual(squareToScreen(screenToSquare(column,row,side), side), {column,row});
  }
  assert.deepEqual(parseMove('a10b10'), {from:'a10',to:'b10',pass:false});
  assert.equal(parseMove('e9e9').pass,true);
  assert.throws(()=>parseMove('a11b2'));
});
test('32가지 진영·상차림 FEN 왕복이 화면의 초기 배치와 일치한다', () => {
  const key = p => `${p.side}/${p.type}/${p.column}/${p.row}`;
  for (const playerSide of ['cho','han']) for(const playerFormation of FORMATIONS) for(const aiFormation of FORMATIONS) {
    const settings={...defaults,playerSide,playerFormation,aiFormation};
    assert.deepEqual(piecesFromFen(initialFen(settings),playerSide).map(key).sort(),createInitialPosition(settings).map(key).sort());
  }
});
test('기본 시간→초읽기, 정확한 경계, 백그라운드 경과를 한 번에 정산한다', () => {
  const clock=createClocks({...defaults,minutes:1,byoCount:3,byoSeconds:10}).cho;
  assert.equal(consumeTime(clock,59_999,10).mainMs,1);
  assert.deepEqual(consumeTime(clock,60_000,10),{mainMs:0,periods:3,periodMs:10_000,expired:false});
  assert.deepEqual(consumeTime(clock,70_000,10),{mainMs:0,periods:2,periodMs:10_000,expired:false});
  assert.equal(consumeTime(clock,89_999,10).expired,false);
  assert.deepEqual(consumeTime(clock,90_000,10),{mainMs:0,periods:0,periodMs:0,expired:true});
  assert.equal(consumeTime(clock,300_000,10).expired,true);
  assert.equal(availableTime(clock,10),90_000);
  assert.equal(formatClock(consumeTime(clock,59_999,10)),'00:01');
});
test('초읽기만 시작하며 착수 뒤 현재 회차 시간만 복원한다', () => {
  const clock=createClocks({...defaults,minutes:0,byoCount:3,byoSeconds:10}).cho;
  const used=consumeTime(clock,15_000,10);
  assert.equal(used.periods,2);
  assert.equal(used.periodMs,5000);
  assert.deepEqual(completeTurn(used,10),{mainMs:0,periods:2,periodMs:10_000,expired:false});
});
test('27개 상대 난이도는 실력과 탐색 시간이 순서대로 증가한다', () => {
  const profiles=AI_LEVELS.map(difficultyProfile);
  assert.equal(profiles.length,27);
  assert.deepEqual(profiles[0],{skill:-20,movetime:180});
  assert.deepEqual(profiles.at(-1),{skill:20,movetime:3500});
  profiles.slice(1).forEach((p,i)=>{assert.ok(p.skill>profiles[i].skill);assert.ok(p.movetime>profiles[i].movetime);});
});
