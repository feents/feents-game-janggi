/* 탐색은 Emscripten pthread에서 실행되어 stop/dispose 메시지를 계속 받을 수 있다. */
importScripts('./stockfish.js');
let engine, waiter;
let logTail = '';
let disposed = false;
let nnueActive = false;
const downloads = new AbortController();
const ready = (async () => {
  // Worker 주소 기준으로 로드해 개발/운영 및 하위 경로 배포에서 같은 모델을 사용한다.
  const configResponse = await fetch(new URL('nnue.json', self.location.href), { signal: downloads.signal, cache: 'no-cache' });
  if (!configResponse.ok) throw new Error('NNUE 모델 정보를 불러올 수 없어요.');
  const model = await configResponse.json();
  if (!/^janggi-[a-f0-9]{12}\.nnue$/.test(model.file)
      || !Number.isSafeInteger(model.bytes) || model.bytes <= 0 || !/^[a-f0-9]{64}$/.test(model.sha256)) {
    throw new Error('NNUE 모델 정보가 올바르지 않아요.');
  }
  const response = await fetch(new URL(model.file, self.location.href), { signal: downloads.signal, cache: 'force-cache' });
  if (!response.ok) throw new Error('장기 NNUE 모델을 불러올 수 없어요.');
  const data = await response.arrayBuffer();
  if (data.byteLength !== model.bytes) throw new Error('NNUE 모델 파일이 불완전해요. 다시 시도해 주세요.');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== model.sha256) throw new Error('NNUE 모델 파일을 확인할 수 없어요. 다시 시도해 주세요.');
  if (disposed) throw new Error('엔진 요청이 취소됐어요.');
  engine = await Stockfish({ locateFile: (file) => new URL(file, self.location.href).href });
  if (disposed) { engine.terminate(); throw new Error('엔진 요청이 취소됐어요.'); }
  engine.addMessageListener((output) => {
    for (const line of String(output).split('\n')) {
      logTail = line;
      if (line === `info string NNUE evaluation using /${model.file} enabled`) nnueActive = true;
      if (line === 'info string classical evaluation enabled') nnueActive = false;
      if (waiter && line.startsWith('info string ERROR:')) {
        const done = waiter; waiter = null; clearTimeout(done.timer);
        done.reject(new Error('NNUE 평가를 시작할 수 없어요. 다시 시도해 주세요.'));
      } else if (waiter && waiter.match(line)) {
        const done = waiter; waiter = null; clearTimeout(done.timer); done.resolve(line);
      }
    }
  });
  const path = `/${model.file}`;
  try { engine.FS.writeFile(path, new Uint8Array(data)); }
  catch (error) { engine.terminate(); throw error; }
  return path;
})();
// 초기화 요청이 도착하기 전에 다운로드가 실패해도 요청 처리 시 오류를 전달한다.
ready.catch(() => {});
function command(text) { engine.postMessage(text); }
function until(match, send, timeout = 15_000) {
  if (waiter) return Promise.reject(new Error('AI 요청이 중복됐어요.'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiter = null; reject(new Error(`AI 응답 시간이 초과됐어요. ${logTail}`)); }, timeout);
    waiter = { match, resolve, reject, timer };
    send();
  });
}
self.onmessage = async ({ data: { id, type, payload } }) => {
  if (type === 'dispose') {
    disposed = true; downloads.abort();
    if (waiter) { clearTimeout(waiter.timer); waiter = null; }
    engine?.terminate(); self.postMessage({ disposed: true }); self.close(); return;
  }
  try {
    const nnuePath = await ready;
    if (disposed) return;
    if (type === 'init') {
      await until((line) => line === 'uciok', () => command('uci'));
      command('setoption name Threads value 1');
      command('setoption name Hash value 16');
      command(`setoption name UCI_Variant value ${payload.variant}`);
      command(`setoption name EvalFile value ${nnuePath}`);
      command('setoption name Use NNUE value true');
      command('setoption name UCI_LimitStrength value false');
      command(`setoption name Skill Level value ${payload.skill}`);
      command('ucinewgame');
      command('position startpos');
      nnueActive = false;
      await until((line) => line === 'readyok', () => { command('eval'); command('isready'); });
      if (!nnueActive) throw new Error('장기 NNUE 평가가 활성화되지 않았어요.');
      self.postMessage({ id, value: true });
    } else if (type === 'search') {
      command(`position fen ${payload.fen}${payload.moves.length ? ` moves ${payload.moves.join(' ')}` : ''}`);
      const line = await until((output) => output.startsWith('bestmove '), () => command(`go movetime ${payload.movetime}`), payload.movetime + 10_000);
      if (!nnueActive) throw new Error('장기 NNUE 평가가 활성화되지 않았어요.');
      self.postMessage({ id, value: line.split(/\s+/)[1] });
    }
  } catch (error) { if (!disposed) self.postMessage({ id, error: error.message || 'AI 엔진 오류예요.' }); }
};
