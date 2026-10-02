import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ffish, fixture, moves as legalMoves } from './helpers/rules.js';
import { INITIAL_SETTINGS, AI_LEVELS } from '../src/settings.js';
import { initialFen } from '../src/game/position-codec.js';
import { difficultyProfile } from '../src/engine/difficulty.js';

test('실제 NNUE AI WASM: 27단계·8규칙 탐색과 완결 대국에서 규칙 엔진과 일치', {timeout:90000}, async()=>{
  // 배포용 classic script를 Node CommonJS에서도 같은 pthread 경로로 실행한다.
  const dir=await mkdtemp(join(tmpdir(),'feents-ai-test-'));
  let engine, waiter, nnueActive = false;
  const model = JSON.parse(await readFile(new URL('../public/engine/nnue.json', import.meta.url), 'utf8'));
  const command=text=>engine.postMessage(text);
  const until=(match,send)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{waiter=null;reject(new Error('AI 응답 시간 초과'));},15000);
    waiter={match,resolve:line=>{clearTimeout(timer);waiter=null;resolve(line);}};send();
  });
  const search=async(fen,history,time=15)=>{
    command(`position fen ${fen}${history.length?' moves '+history.join(' '):''}`);
    const line=await until(s=>s.startsWith('bestmove '),()=>command(`go movetime ${time}`));
    assert.ok(nnueActive, '모든 탐색은 실제 NNUE 평가를 사용해야 해요.');
    return line.split(/\s+/)[1];
  };
  const init=async(variant,skill)=>{
    nnueActive = false;
    for(const cmd of ['setoption name Threads value 1','setoption name Hash value 16',`setoption name UCI_Variant value ${variant}`,`setoption name EvalFile value /${model.file}`,'setoption name Use NNUE value true',`setoption name Skill Level value ${skill}`,'ucinewgame'])command(cmd);
    await until(s=>s==='readyok',()=>command('isready'));
  };
  try {
    for(const file of ['stockfish.js','stockfish.wasm'])await copyFile(new URL(`../public/engine/${file}`,import.meta.url),join(dir,file));
    const factory=createRequire(import.meta.url)(join(dir,'stockfish.js'));
    engine=await factory();
    engine.FS.writeFile(`/${model.file}`, await readFile(new URL(`../public/engine/${model.file}`, import.meta.url)));
    engine.addMessageListener(output=>{for(const line of String(output).split('\n')){
      if(line===`info string NNUE evaluation using /${model.file} enabled`)nnueActive=true;
      if(line==='info string classical evaluation enabled')nnueActive=false;
      if(waiter?.match(line))waiter.resolve(line);
    }});
    await until(s=>s==='uciok',()=>command('uci'));
    const fen=initialFen(INITIAL_SETTINGS);
    const board=new ffish.Board('feents-b1-m0-r0',fen);
    try {for(const level of AI_LEVELS){await init('feents-b1-m0-r0',difficultyProfile(level).skill);assert.ok(legalMoves(board).includes(await search(fen,[])),level);}}finally{board.delete();}
    let verified=0;
    for(const b of [0,1])for(const m of [0,1])for(const r of [0,1]) {
      const variant=`feents-b${b}-m${m}-r${r}`;
      await init(variant,20);
      const rules=new ffish.Board(variant,fen), history=[];
      try {
        for(let ply=0;ply<24 && rules.result()==='*';ply++) {
          const move=await search(fen,history);
          assert.ok(legalMoves(rules).includes(move),`${variant}: ${history.join(' ')} -> ${move}`);
          assert.ok(rules.push(move));history.push(move);verified++;
        }
      }finally{rules.delete();}
    }
    assert.ok(verified>=100);
    // 세 번째 반복을 만들 직전의 전체 이력을 AI에 전달한다.
    await init('feents-b1-m0-r1',20);
    const history=['a1a2','a10a9','a2a1','a9a10','a1a2','a10a9','a2a1'];
    const repeated=new ffish.Board('feents-b1-m0-r1',fen);
    try {for(const m of history)assert.ok(repeated.push(m));const move=await search(fen,history,50);assert.notEqual(move,'a9a10');assert.ok(legalMoves(repeated).includes(move));}finally{repeated.delete();}
    // 초기 배치부터 끝까지 스스로 두어 종료와 착수 일관성을 확인한다.
    await init('feents-b1-m1-r1',20);
    const fullGame=new ffish.Board('feents-b1-m1-r1',fen), gameMoves=[];
    try {
      for(let ply=0;ply<400 && fullGame.result()==='*';ply++) {
        const move=await search(fen,gameMoves,10);assert.ok(legalMoves(fullGame).includes(move));assert.ok(fullGame.push(move));gameMoves.push(move);
      }
      assert.notEqual(fullGame.result(),'*','400수 안에 완결 대국 도달');
      console.log(`AI 완결 대국: ${gameMoves.length}수, ${fullGame.result()}, ${fullGame.terminationReason()}`);
    }finally{fullGame.delete();}
    // 강제 한 수 외통의 탐색도 실제로 끝내는 수를 선택해야 한다.
    const mateFen=fixture({e2:'K',f9:'k',d3:'r',e4:'r',f3:'r'},'b');
    await init('feents-b0-m0-r0',20);
    const mate=new ffish.Board('feents-b0-m0-r0',mateFen);
    try {const move=await search(mateFen,[],100);assert.ok(mate.push(move));assert.equal(mate.result(),'0-1');assert.equal(mate.terminationReason(),'checkmate');}finally{mate.delete();}
  }finally{engine?.terminate();await rm(dir,{recursive:true,force:true});}
});
