import test from 'node:test';
import assert from 'node:assert/strict';
import { ffish, fixture, withBoard, moves } from './helpers/rules.js';
import { INITIAL_SETTINGS, FORMATIONS } from '../src/settings.js';
import { initialFen, rulesVariant } from '../src/game/position-codec.js';

const kings={d2:'K',f9:'k'};
test('실제 WASM은 모든 규칙·진영·상차림 256개 초기 조합을 허용한다', () => {
  for(const bigjang of [false,true]) for(const materialVictory of [false,true]) for(const repetitionLimit of [false,true]) {
    const variant=rulesVariant({bigjang,materialVictory,repetitionLimit});
    assert.ok(ffish.variants().split(' ').includes(variant));
    for(const playerSide of ['cho','han']) for(const playerFormation of FORMATIONS) for(const aiFormation of FORMATIONS) {
      const fen=initialFen({...INITIAL_SETTINGS,playerSide,playerFormation,aiFormation});
      assert.equal(ffish.validateFen(fen,variant),1);
      withBoard(fen,b=>{assert.equal(b.result(),'*');assert.ok(moves(b).length>20);assert.equal(b.turn(),true);},variant);
    }
  }
});
test('차의 직선 이동·잡기와 아군/상대 뒤 차단', () => withBoard(fixture({...kings,a1:'R',a4:'P',d1:'p'}), b=>{
  assert.ok(moves(b).includes('a1a3'));assert.ok(moves(b).includes('a1d1'));
  for(const m of ['a1a4','a1a5','a1e1','a1b2']) assert.ok(!moves(b).includes(m),m);
}));
test('마의 멱과 상의 두 차단점', () => {
  withBoard(fixture({...kings,b1:'N'}),b=>assert.ok(moves(b).includes('b1c3')));
  withBoard(fixture({...kings,b1:'N',b2:'P'}),b=>assert.ok(!moves(b).includes('b1c3')));
  withBoard(fixture({...kings,a1:'B'}),b=>assert.ok(moves(b).includes('a1c4')));
  for(const blocker of ['a2','b3']) withBoard(fixture({...kings,a1:'B',[blocker]:'P'}),b=>assert.ok(!moves(b).includes('a1c4')));
});
test('포는 반드시 비포 기물을 넘고 포를 넘거나 잡지 못한다', () => {
  withBoard(fixture({...kings,a1:'C',a3:'P',a6:'p'}),b=>{assert.ok(moves(b).includes('a1a4'));assert.ok(moves(b).includes('a1a6'));assert.ok(!moves(b).includes('a1a2'));});
  withBoard(fixture({...kings,a1:'C',a3:'C'}),b=>assert.ok(!moves(b).includes('a1a4')));
  withBoard(fixture({...kings,a1:'C',a3:'P',a6:'c'}),b=>assert.ok(!moves(b).includes('a1a6')));
});
test('졸은 전진·가로만, 궁성에서는 선을 따라 대각선 이동', () => {
  withBoard(fixture({...kings,e5:'P'}),b=>{for(const m of ['e5e6','e5d5','e5f5'])assert.ok(moves(b).includes(m));for(const m of ['e5e4','e5f6'])assert.ok(!moves(b).includes(m));});
  withBoard(fixture({e2:'K',d10:'k',d8:'P'}),b=>assert.ok(moves(b).includes('d8e9')));
  withBoard(fixture({d2:'K',f9:'k',d1:'R'}),b=>assert.ok(moves(b).includes('d1f3')));
  withBoard(fixture({d2:'K',f9:'k',d1:'C',e2:'P'}),b=>assert.ok(moves(b).includes('d1f3')));
});
test('궁과 사는 궁성을 벗어나지 않으며 장군 중 한수쉼은 불가', () => {
  withBoard(fixture({...kings,e2:'A'}),b=>{assert.ok(moves(b).includes('e2f3'));assert.ok(!moves(b).includes('e2g2'));assert.ok(!moves(b).includes('d2c2'));});
  withBoard(fixture({...kings,d5:'r'}),b=>{assert.equal(b.isCheck(),true);assert.ok(!moves(b).includes('d2d2'));assert.ok(!moves(b).includes('d2d3'));assert.ok(moves(b).includes('d2e2'));});
});
test('빅장 켬: 대면 해소 또는 수용 / 끔: 대면 유지 가능', () => {
  const fen=fixture({e2:'K',e9:'k',e5:'R',a7:'p'});
  withBoard(fen,b=>{
    assert.ok(b.push('e5d5'));assert.equal(b.isBikjang(),true);
    assert.ok(!moves(b).includes('a7a6'));assert.ok(moves(b).includes('e9f9'));
    assert.ok(b.push('e9e9'));assert.equal(b.result(),'1/2-1/2');assert.equal(b.terminationReason(),'bikjang');
  },'feents-b1-m0-r0');
  withBoard(fen,b=>{assert.ok(b.push('e5d5'));assert.equal(b.isBikjang(),false);assert.ok(b.push('a7a6'));assert.equal(b.result(),'*');});
});
test('연속 한수쉼은 무승부, 외통과 구분된다', () => withBoard(initialFen(INITIAL_SETTINGS),b=>{
  assert.ok(b.push('e2e2'));assert.equal(b.result(),'*');assert.ok(b.push('e9e9'));assert.equal(b.result(),'1/2-1/2');assert.equal(b.terminationReason(),'double-pass');
},'feents-b1-m0-r1'));
test('기물승은 덤 제외 10점 경계이며 승패에는 한 덤을 더한다', () => {
  const cases=[
    [{...kings,a1:'N',b1:'N',a10:'n',b10:'n'},'*'],
    [{...kings,a1:'C',b1:'P',a10:'r'},'0-1'],
    [{...kings,a1:'R',a10:'c',b10:'p'},'1-0'],
    [{...kings,a1:'C',b1:'P',a10:'c',b10:'p'},'0-1'],
    [{...kings,a1:'N',b1:'N',a10:'c',b10:'p'},'0-1'],
  ];
  for(const [pieces,result] of cases) for(const turn of ['w','b']) withBoard(fixture(pieces,turn),b=>{assert.equal(b.result(),result);assert.equal(b.terminationReason(),result==='*'?'':'material');},'feents-b0-m1-r0');
  withBoard(fixture(kings),b=>assert.equal(b.result(),'*'));
});
test('외통은 기물승보다 먼저 판정한다', () => {
  // 초 39점, 한 6점: 기물 점수로는 초가 이기지만 이미 초가 외통이다.
  const fen=fixture({e1:'K',f9:'k',a4:'R',a5:'R',a6:'R',d2:'p',e2:'p',f2:'p'});
  for(const m of [0,1]) withBoard(fen,b=>{assert.equal(b.isCheck(),true);assert.equal(b.result(),'0-1');assert.equal(b.terminationReason(),'checkmate');},`feents-b0-m${m}-r0`);
});
test('반복수는 초기 국면을 포함한 세 번째 국면을 금지하고 꺼지면 계속 진행한다', () => {
  const fen=initialFen(INITIAL_SETTINGS), cycle=['a1a2','a10a9','a2a1','a9a10'];
  for(const r of [0,1]) withBoard(fen,b=>{
    for(const m of [...cycle,...cycle.slice(0,3)]) assert.ok(b.push(m),m);
    assert.equal(moves(b).includes('a9a10'),!r);
    assert.equal(b.push('a9a10'),!r);
    if(!r) {for(const m of [...cycle,...cycle])assert.ok(b.push(m));assert.equal(b.result(),'*');}
  },`feents-b1-m0-r${r}`);
});
test('착수 이력 복원은 반복 제한까지 복원한다', () => {
  const fen=initialFen(INITIAL_SETTINGS), history=['a1a2','a10a9','a2a1','a9a10','a1a2','a10a9','a2a1'];
  withBoard(fen,b=>{for(const m of history)assert.ok(b.push(m));const fullMoves=moves(b);b.pop();assert.ok(b.push(history.at(-1)));assert.deepEqual(moves(b),fullMoves);assert.ok(!fullMoves.includes('a9a10'));},'feents-b1-m0-r1');
});
