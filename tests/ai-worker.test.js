import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { mkdtemp, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ffish, moves as legalMoves } from './helpers/rules.js';
import { INITIAL_SETTINGS } from '../src/settings.js';
import { initialFen } from '../src/game/position-codec.js';

const workerSource = await readFile(new URL('../public/engine/ai-worker.js', import.meta.url), 'utf8');
const metadata = await readFile(new URL('../public/engine/nnue.json', import.meta.url));
const model = JSON.parse(metadata);
const weights = await readFile(new URL(`../public/engine/${model.file}`, import.meta.url));

function worker({ url = 'https://game.example/engine/ai-worker.js', factory, fetchOverride } = {}) {
  const responses = [], requests = [];
  let closed = false, serial = 0;
  const location = new URL(url);
  const fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (fetchOverride) return fetchOverride(url, options);
    const file = String(url).slice(new URL('.', location).href.length);
    return new Response(file === 'nnue.json' ? metadata : file === model.file ? weights : '', { status: ['nnue.json', model.file].includes(file) ? 200 : 404 });
  };
  const self = { location, postMessage: data => responses.push(data), close: () => { closed = true; } };
  const context = vm.createContext({
    self, importScripts: path => assert.equal(path, './stockfish.js'), Stockfish: factory,
    fetch, crypto: webcrypto, URL, AbortController, Uint8Array, setTimeout, clearTimeout,
  });
  vm.runInContext(workerSource, context, { filename: 'ai-worker.js' });
  return {
    requests, responses, get closed() { return closed; },
    async request(type, payload = {}) {
      const id = ++serial;
      await self.onmessage({ data: { id, type, payload } });
      return responses.find(response => response.id === id);
    },
  };
}

test('실제 AI Worker는 루트·하위 배포 경로에서 NNUE를 로드한 뒤 저급·고단 탐색을 한다', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'feents-nnue-worker-'));
  try {
    for (const file of ['stockfish.js', 'stockfish.wasm']) await copyFile(new URL(`../public/engine/${file}`, import.meta.url), join(directory, file));
    const createEngine = createRequire(import.meta.url)(join(directory, 'stockfish.js'));
    for (const url of ['http://127.0.0.1:5173/engine/ai-worker.js', 'https://game.example/janggi/engine/ai-worker.js']) {
      let engine;
      const runner = worker({ url, factory: async options => {
        assert.equal(options.locateFile('stockfish.wasm'), new URL('stockfish.wasm', url).href);
        // Node 파일 로딩만 치환하고 배포 Worker 코드는 그대로 실행한다. HTTP 서버는 띄우지 않는다.
        engine = await createEngine({ locateFile: file => join(directory, file) });
        return engine;
      } });
      const fen = initialFen(INITIAL_SETTINGS), board = new ffish.Board('feents-b0-m1-r1', fen);
      try {
        for (const skill of [-20, 20]) {
          const initialized = await runner.request('init', { variant: 'feents-b0-m1-r1', skill });
          assert.equal(initialized?.error, undefined, initialized?.error);
          assert.equal(initialized?.value, true);
          const searched = await runner.request('search', { fen, moves: [], movetime: 50 });
          assert.equal(searched?.error, undefined, searched?.error);
          assert.ok(legalMoves(board).includes(searched.value));
        }
        assert.deepEqual(runner.requests.map(request => request.url), [new URL('nnue.json', url).href, new URL(model.file, url).href]);
      } finally {
        board.delete();
        await runner.request('dispose');
        engine?.terminate();
      }
      assert.ok(runner.closed);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('AI Worker는 누락·잘린 모델·같은 크기의 손상 모델을 초기화 전에 거부한다', async () => {
  const broken = Buffer.from(weights); broken[broken.length - 1] ^= 1;
  for (const [response, expected] of [
    [new Response('', { status: 404 }), /모델을 불러올/],
    [new Response(weights.subarray(0, 100)), /파일이 불완전/],
    [new Response(broken), /파일을 확인/],
  ]) {
    const actual = worker({ factory: () => assert.fail('손상 모델로 엔진을 실행하면 안 돼요.'),
      fetchOverride: url => String(url).endsWith('nnue.json') ? new Response(metadata) : response });
    try { assert.match((await actual.request('init', { variant: 'feents-b0-m1-r1', skill: 20 })).error, expected); }
    finally { await actual.request('dispose'); }
  }
});

test('AI Worker는 classical 평가로의 조용한 대체를 허용하지 않는다', async () => {
  let listener, terminated = false;
  const runner = worker({ factory: async () => ({
    FS: { writeFile() {} }, addMessageListener: callback => { listener = callback; },
    postMessage: command => {
      if (command === 'uci') listener('uciok');
      if (command === 'eval') listener('info string classical evaluation enabled');
      if (command === 'isready') listener('readyok');
    }, terminate: () => { terminated = true; },
  }) });
  try { assert.match((await runner.request('init', { variant: 'unsupported', skill: -20 })).error, /활성화되지/); }
  finally { await runner.request('dispose'); }
  assert.ok(terminated);
});

test('모델 다운로드 중 취소하면 요청을 중단하고 엔진과 새 응답을 만들지 않는다', async () => {
  let signal;
  const runner = worker({ factory: () => assert.fail('취소 후 엔진 실행'), fetchOverride: (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  const pending = runner.request('init', { variant: 'feents-b0-m1-r1', skill: -20 });
  await runner.request('dispose');
  await pending;
  assert.ok(signal.aborted);
  assert.ok(runner.closed);
  assert.equal(runner.responses.length, 1);
  assert.ok(runner.responses[0].disposed);
});
