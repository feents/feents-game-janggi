import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController, resultText } from '../src/game/controller.js';
import { INITIAL_SETTINGS } from '../src/settings.js';
import { ffish } from './helpers/rules.js';

const flush = () => new Promise(resolve=>setImmediate(resolve));
function harness({ deferInit = false } = {}) {
  let time=0;
  const searches=[], engines=[], initializations=[];
  const createEngine=kind=>{
    let board;
    const initialized=value=>deferInit
      ? new Promise((resolve,reject)=>initializations.push({resolve:()=>resolve(value),reject,engine}))
      : Promise.resolve(value);
    const engine={kind, closed:false,
      request(type,payload) {
        if(kind==='ai') {
          if(type==='init') return initialized(true);
          return new Promise((resolve,reject)=>searches.push({resolve,reject,payload,engine}));
        }
        if(type==='init') {board=new ffish.Board(payload.variant,payload.fen);for(const m of payload.moves)assert.ok(board.push(m));}
        else assert.ok(board.push(payload.move));
        const position={fen:board.fen(),turn:board.turn()?'cho':'han',legalMoves:board.result()==='*'?board.legalMoves().split(' '):[],check:board.isCheck(),bikjang:board.isBikjang(),result:board.result(),reason:board.terminationReason()};
        return type==='init' ? initialized(position) : Promise.resolve(position);
      },
      destroy(){this.closed=true;board?.delete();board=undefined;}
    };engines.push(engine);return engine;
  };
  const game=new GameController({createEngine,now:()=>time});
  return {game,searches,engines,initializations,advance:ms=>{time+=ms;game.tick();}};
}

test('두 엔진이 모두 준비될 때까지 시간을 멈추고 준비 직후 첫 착수를 허용한다',async()=>{
  for(const first of ['rules','ai']) {
    const h=harness({deferInit:true});try {
      const starting=h.game.start(INITIAL_SETTINGS);
      assert.equal(h.game.state.phase,'preparing');
      assert.equal(h.game.state.turnStartedAt,null);
      assert.equal(await h.game.makeMove('a4a5'),false);
      h.initializations.find(init=>init.engine.kind===first).resolve();await flush();
      h.advance(60_000);
      assert.equal(h.game.state.phase,'preparing');
      assert.equal(h.game.state.displayClocks.cho.mainMs,300000);
      assert.equal(h.searches.length,0);
      h.initializations.find(init=>init.engine.kind!==first).resolve();await starting;
      assert.equal(h.game.state.phase,'humanTurn');
      assert.equal(h.game.state.turnStartedAt,60_000);
      assert.equal(await h.game.makeMove('a4a5'),true);
      assert.deepEqual(h.game.state.moves,['a4a5']);
      assert.equal(h.game.state.clocks.cho.mainMs,300000);
    }finally{h.game.destroy();}
  }
});
test('한 선택 시 엔진 준비가 끝난 뒤에만 AI 선공을 시작한다',async()=>{
  const h=harness({deferInit:true});try {
    const starting=h.game.start({...INITIAL_SETTINGS,playerSide:'han'});
    h.initializations[1].resolve();await flush();h.advance(60_000);
    assert.equal(h.game.state.phase,'preparing');assert.equal(h.searches.length,0);
    h.initializations[0].resolve();await starting;
    assert.equal(h.game.state.phase,'aiThinking');assert.equal(h.searches.length,1);
    assert.equal(h.game.state.turnStartedAt,60_000);
    h.searches[0].resolve('a4a5');await flush();
    assert.equal(h.game.state.phase,'humanTurn');
    assert.equal(await h.game.makeMove('a7a6'),true);
  }finally{h.game.destroy();}
});
test('초기화 실패는 준비 상태를 끝내고 재시도 후 첫 수를 둘 수 있다',async()=>{
  const h=harness({deferInit:true});try {
    const starting=h.game.start(INITIAL_SETTINGS);
    h.initializations[1].reject(new Error('초기화 실패'));await starting;
    assert.equal(h.game.state.phase,'engineError');assert.equal(h.game.state.error,'초기화 실패');
    assert.ok(h.engines.every(engine=>engine.closed));
    const retry=h.game.prepare();
    h.initializations[0].resolve();await flush();
    assert.equal(h.game.state.phase,'preparing');
    h.initializations[2].resolve();h.initializations[3].resolve();await retry;
    assert.equal(h.game.state.error,'');assert.equal(h.game.state.phase,'humanTurn');
    assert.equal(await h.game.makeMove('a4a5'),true);
  }finally{h.game.destroy();}
});
test('새 대국 준비 중 이전 대국의 늦은 초기화 응답을 무시한다',async()=>{
  const h=harness({deferInit:true});try {
    const previous=h.game.start(INITIAL_SETTINGS);
    const current=h.game.start({...INITIAL_SETTINGS,playerSide:'han'});
    h.initializations[0].resolve();h.initializations[1].resolve();await previous;
    assert.equal(h.game.state.gameId,2);assert.equal(h.game.state.phase,'preparing');
    assert.equal(h.searches.length,0);
    h.initializations[2].resolve();h.initializations[3].resolve();await current;
    assert.equal(h.game.state.phase,'aiThinking');assert.equal(h.searches.length,1);
    assert.equal(h.game.state.settings.playerSide,'han');
  }finally{h.game.destroy();}
});

test('초 선택은 사용자 선공, 한 선택은 AI 선공이며 첫 사용자 수 전에는 무를 수 없다',async()=>{
  for(const playerSide of ['cho','han']) {
    const h=harness();try {
      await h.game.start({...INITIAL_SETTINGS,playerSide});
      assert.equal(h.game.state.phase,playerSide==='cho'?'humanTurn':'aiThinking');
      assert.equal(h.game.state.canUndo,false);
      if(playerSide==='han') {h.searches[0].resolve('a4a5');await flush();assert.equal(h.game.state.phase,'humanTurn');assert.equal(h.game.state.canUndo,false);}
    }finally{h.game.destroy();}
  }
});
test('AI 생각 중 무르기는 한 수·시간을 복원하고 뒤늦은 AI 응답을 버린다',async()=>{
  const h=harness();try {
    await h.game.start(INITIAL_SETTINGS);h.advance(3000);
    await h.game.makeMove('a4a5');assert.equal(h.game.state.clocks.cho.mainMs,297000);
    assert.equal(h.game.state.canUndo,true);const pending=h.searches[0];
    await h.game.undo();assert.equal(h.game.state.moves.length,0);assert.equal(h.game.state.clocks.cho.mainMs,300000);
    assert.equal(h.game.state.undoUsed,1);assert.equal(h.game.state.phase,'humanTurn');
    pending.resolve('a7a6');await flush();assert.equal(h.game.state.moves.length,0);
    assert.ok(pending.engine.closed);
  }finally{h.game.destroy();}
});
test('AI 탐색 중·응수 후 무르기는 준비 상태 없이 복원하며 복원 중 착수·중복 무르기·시계를 멈춘다',async()=>{
  for(const afterReply of [false,true]) {
    const h=harness({deferInit:true});try {
      const starting=h.game.start(INITIAL_SETTINGS);
      h.initializations.forEach(init=>init.resolve());await starting;
      const initial=h.game.state.history[0];
      h.advance(3000);await h.game.makeMove('a4a5');
      const previousSearch=h.searches[0];
      if(afterReply){previousSearch.resolve('a7a6');await flush();}
      const phases=[];
      const unsubscribe=h.game.subscribe(()=>phases.push(h.game.state.phase));
      try {
        const restoring=h.game.undo();
        assert.equal(h.game.state.phase,'restoring');assert.equal(h.game.state.canUndo,false);
        assert.equal(h.game.state.turnStartedAt,null);
        assert.equal(await h.game.makeMove('a4a5'),false);
        await h.game.undo();assert.equal(h.engines.length,4);assert.equal(h.game.state.undoUsed,1);
        h.advance(30_000);assert.deepEqual(h.game.state.displayClocks,initial.clocks);
        if(!afterReply){previousSearch.resolve('a7a6');await flush();}
        h.initializations[2].resolve();await flush();
        assert.equal(h.game.state.phase,'restoring');assert.equal(h.game.state.moves.length,0);
        h.initializations[3].resolve();await restoring;
        assert.ok(!phases.includes('preparing'));
        assert.ok(phases.slice(0,-1).every(phase=>phase==='restoring'));
        assert.equal(h.game.state.phase,'humanTurn');assert.equal(h.game.state.turnStartedAt,33_000);
        assert.deepEqual(h.game.state.pieces,initial.pieces);assert.deepEqual(h.game.state.captured,initial.captured);
        assert.equal(h.game.state.fen,initial.fen);assert.equal(h.game.state.history.length,1);
        assert.deepEqual(h.game.state.records,[]);assert.deepEqual(h.game.state.moves,[]);
        assert.equal(await h.game.makeMove('a4a5'),true);
      }finally{unsubscribe();}
    }finally{h.game.destroy();}
  }
});
test('무르기 복원 실패·페이지 이탈은 오류로 전환하고 명시적 재시도로 복구한다',async()=>{
  for(const failure of ['init','suspend']) {
    const h=harness({deferInit:true});try {
      const starting=h.game.start(INITIAL_SETTINGS);
      h.initializations.forEach(init=>init.resolve());await starting;
      await h.game.makeMove('a4a5');const restoring=h.game.undo();
      assert.equal(h.game.state.phase,'restoring');
      if(failure==='init') h.initializations[2].reject(new Error('복원 실패'));
      else h.game.suspend();
      await flush();assert.equal(h.game.state.phase,'engineError');
      assert.ok(h.engines.every(engine=>engine.closed));
      const retry=h.game.prepare();assert.equal(h.game.state.phase,'preparing');
      h.initializations[2].resolve();h.initializations[3].resolve();await restoring;
      assert.equal(h.game.state.phase,'preparing');
      h.initializations[4].resolve();h.initializations[5].resolve();await retry;
      assert.equal(h.game.state.phase,'humanTurn');assert.equal(h.game.state.error,'');
      assert.deepEqual(h.game.state.moves,[]);assert.equal(await h.game.makeMove('a4a5'),true);
    }finally{h.game.destroy();}
  }
});
test('무르기 복원 중 새 대국을 시작하면 이전 복원 응답을 버린다',async()=>{
  const h=harness({deferInit:true});try {
    const starting=h.game.start(INITIAL_SETTINGS);
    h.initializations.forEach(init=>init.resolve());await starting;
    await h.game.makeMove('a4a5');const restoring=h.game.undo();
    const next=h.game.start({...INITIAL_SETTINGS,playerSide:'han'});
    h.initializations[2].resolve();h.initializations[3].resolve();await restoring;
    assert.equal(h.game.state.phase,'preparing');assert.equal(h.game.state.gameId,2);
    h.initializations[4].resolve();h.initializations[5].resolve();await next;
    assert.equal(h.game.state.phase,'aiThinking');assert.equal(h.game.state.settings.playerSide,'han');
    assert.equal(h.game.state.undoUsed,0);assert.deepEqual(h.game.state.moves,[]);
    h.searches.at(-1).resolve('a4a5');await flush();assert.equal(h.game.state.phase,'humanTurn');
  }finally{h.game.destroy();}
});
test('AI 응수 뒤 무르기는 두 수를 복원하며 제한 횟수와 무제한을 지킨다',async()=>{
  for(const undoCount of [0,1,11]) {
    const h=harness();try {
      await h.game.start({...INITIAL_SETTINGS,undoCount});
      await h.game.makeMove('a4a5');h.searches[0].resolve('a7a6');await flush();
      assert.equal(h.game.state.moves.length,2);assert.equal(h.game.state.canUndo,undoCount!==0);
      await h.game.undo();
      if(!undoCount){assert.equal(h.game.state.moves.length,2);continue;}
      assert.equal(h.game.state.moves.length,0);assert.equal(h.game.state.records.length,0);
      await h.game.makeMove('a4a5');assert.equal(h.game.state.canUndo,undoCount===11);
    }finally{h.game.destroy();}
  }
});
test('새 게임·기권 후 이전 탐색 결과와 오류는 새 대국에 반영되지 않는다',async()=>{
  const h=harness();try {
    await h.game.start(INITIAL_SETTINGS);await h.game.makeMove('a4a5');
    const old=h.searches[0];h.game.resign();assert.equal(h.game.state.reason,'resign');assert.equal(h.game.state.result,'0-1');
    await h.game.start({...INITIAL_SETTINGS,playerSide:'han'});old.reject(new Error('늦은 오류'));await flush();
    assert.equal(h.game.state.phase,'aiThinking');assert.equal(h.game.state.moves.length,0);
    h.searches.at(-1).resolve('c4c5');await flush();assert.equal(h.game.state.moves.length,1);
  }finally{h.game.destroy();}
});
test('연속 한수쉼으로 종료하면 결과·기보를 보존하고 양쪽 엔진을 종료한다',async()=>{
  const h=harness();try {
    await h.game.start(INITIAL_SETTINGS);await h.game.pass();h.searches[0].resolve('e9e9');await flush();
    assert.equal(h.game.state.phase,'finished');assert.equal(h.game.state.result,'1/2-1/2');assert.equal(h.game.state.records.length,2);
    assert.equal(resultText(h.game.state),'무승부 · 양쪽 한수쉼');assert.ok(h.engines.every(e=>e.closed));
  }finally{h.game.destroy();}
});
test('AI 탐색 중 시간 초과는 즉시 종료하고 지연 응답을 무시한다',async()=>{
  const h=harness();try {
    await h.game.start({...INITIAL_SETTINGS,playerSide:'han',minutes:0,byoCount:1,byoSeconds:10});
    h.advance(10_000);assert.equal(h.game.state.reason,'timeout');assert.equal(h.game.state.result,'0-1');
    assert.equal(h.game.state.displayClocks.cho.periods,0);h.searches[0].resolve('a4a5');await flush();assert.equal(h.game.state.moves.length,0);
  }finally{h.game.destroy();}
});
test('오류 시 시간을 멈추고 다시 시도하면 같은 기보와 규칙으로 복원한다',async()=>{
  const h=harness();try {
    await h.game.start({...INITIAL_SETTINGS,repetitionLimit:true});h.advance(5000);await h.game.makeMove('a4a5');
    h.searches[0].reject(new Error('시험 오류'));await flush();assert.equal(h.game.state.phase,'engineError');
    h.advance(60_000);assert.equal(h.game.state.clocks.cho.mainMs,295000);
    await h.game.prepare();assert.equal(h.game.state.phase,'aiThinking');assert.deepEqual(h.searches[1].payload.moves,['a4a5']);
    h.searches[1].resolve('a7a6');await flush();assert.equal(h.game.state.phase,'humanTurn');assert.equal(h.game.state.moves.length,2);
  }finally{h.game.destroy();}
});
test('불법 AI 응답은 판을 바꾸지 않고 복구 가능한 오류로 전환한다',async()=>{
  const h=harness();try {
    await h.game.start({...INITIAL_SETTINGS,playerSide:'han'});h.searches[0].resolve('a4a10');await flush();
    assert.equal(h.game.state.phase,'engineError');assert.equal(h.game.state.moves.length,0);assert.ok(h.engines.every(e=>e.closed));
  }finally{h.game.destroy();}
});

test('페이지를 떠나면 엔진을 닫고 복귀 시 같은 대국을 복구할 수 있다',async()=>{
  const h=harness();try {
    await h.game.start(INITIAL_SETTINGS);h.advance(2000);h.game.suspend();
    assert.equal(h.game.state.phase,'engineError');assert.ok(h.engines.every(e=>e.closed));
    await h.game.prepare();assert.equal(h.game.state.phase,'humanTurn');assert.equal(h.game.state.clocks.cho.mainMs,298000);
  }finally{h.game.destroy();}
});


test('잡힌 말과 이동한 말의 ID를 유지하고 매 수의 복기 국면을 보존한다', async () => {
  const h=harness();try {
    await h.game.start(INITIAL_SETTINGS);
    const original=h.game.state.history[0];
    h.advance(1000);await h.game.makeMove('a4a5');h.searches[0].resolve('a7a6');await flush();
    h.advance(2000);await h.game.makeMove('a5a6');
    const {pieces,captured,history}=h.game.state;
    assert.equal(pieces.find(p=>p.square==='a6').id,'a4');
    assert.equal(captured.length,1);assert.equal(captured[0].id,'a7');assert.equal(captured[0].capturedBy,'cho');
    assert.equal(history.length,4);assert.equal(history[2].pieces.length,32);assert.equal(history[2].captured.length,0);
    assert.equal(history[3].pieces.length,31);assert.equal(history[3].captured.length,1);assert.equal(history[3].lastMove,'a5a6');
    assert.equal(history[0],original);assert.equal(original.clocks.cho.mainMs,300000);
    assert.equal(history[3].clocks.cho.mainMs,297000);
    h.game.resign();assert.equal(h.game.state.history,history);assert.ok(h.engines.every(e=>e.closed));
  }finally{h.game.destroy();}
});
test('잡은 수를 무르면 회수영역·기보·복기 이력을 함께 되돌린다', async () => {
  const h=harness();try {
    await h.game.start(INITIAL_SETTINGS);await h.game.makeMove('a4a5');h.searches[0].resolve('a7a6');await flush();
    await h.game.makeMove('a5a6');assert.equal(h.game.state.captured.length,1);
    await h.game.undo();assert.equal(h.game.state.captured.length,0);assert.equal(h.game.state.history.length,3);
    assert.equal(h.game.state.pieces.find(p=>p.square==='a6').id,'a7');
    assert.equal(h.game.state.pieces.find(p=>p.square==='a5').id,'a4');
    await h.game.makeMove('e4e5');assert.equal(h.game.state.history.length,4);
    assert.equal(h.game.state.history[3].lastMove,'e4e5');assert.equal(h.game.state.history[3].captured.length,0);
  }finally{h.game.destroy();}
});
test('AI가 잡은 말도 AI 진영에 기록하고 응수 후 무르기로 복원한다', async () => {
  const h=harness();try {
    await h.game.start(INITIAL_SETTINGS);await h.game.makeMove('a4a5');h.searches[0].resolve('a7a6');await flush();
    await h.game.makeMove('e4e5');h.searches[1].resolve('a6a5');await flush();
    assert.equal(h.game.state.captured[0].id,'a4');assert.equal(h.game.state.captured[0].capturedBy,'han');
    assert.equal(h.game.state.history.length,5);
    await h.game.undo();assert.equal(h.game.state.captured.length,0);assert.equal(h.game.state.history.length,3);
    assert.equal(h.game.state.pieces.find(p=>p.square==='a5').id,'a4');
  }finally{h.game.destroy();}
});
test('한수쉼도 복기 이력에 포함하고 새 대국은 이전 회수·복기 이력을 비운다', async () => {
  const h=harness();try {
    await h.game.start(INITIAL_SETTINGS);const id=h.game.state.gameId;
    await h.game.pass();h.searches[0].resolve('e9e9');await flush();
    assert.equal(h.game.state.history.length,3);assert.equal(h.game.state.history[1].lastMove,'e2e2');
    assert.deepEqual(h.game.state.history[0].pieces,h.game.state.history[2].pieces);
    await h.game.start({...INITIAL_SETTINGS,playerSide:'han'});
    assert.equal(h.game.state.gameId,id+1);assert.equal(h.game.state.history.length,1);assert.equal(h.game.state.captured.length,0);
  }finally{h.game.destroy();}
});
