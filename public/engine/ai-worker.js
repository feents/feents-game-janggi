/* 탐색은 Emscripten pthread에서 실행되어 stop/dispose 메시지를 계속 받을 수 있다. */
importScripts('./stockfish.js');
let engine, waiter;
let logTail = '';
const ready = Stockfish({ locateFile: (file) => new URL(file, self.location.href).href }).then((module) => {
  engine = module;
  engine.addMessageListener((output) => {
    for (const line of String(output).split('\n')) {
      logTail = line;
      if (waiter && waiter.match(line)) { const done = waiter; waiter = null; clearTimeout(done.timer); done.resolve(line); }
    }
  });
  return module;
});
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
    if (waiter) { clearTimeout(waiter.timer); waiter = null; }
    engine?.terminate(); self.postMessage({ disposed: true }); self.close(); return;
  }
  try {
    await ready;
    if (type === 'init') {
      await until((line) => line === 'uciok', () => command('uci'));
      command('setoption name Use NNUE value false');
      command('setoption name Threads value 1');
      command('setoption name Hash value 16');
      command(`setoption name UCI_Variant value ${payload.variant}`);
      command('setoption name UCI_LimitStrength value false');
      command(`setoption name Skill Level value ${payload.skill}`);
      command('ucinewgame');
      await until((line) => line === 'readyok', () => command('isready'));
      self.postMessage({ id, value: true });
    } else if (type === 'search') {
      command(`position fen ${payload.fen}${payload.moves.length ? ` moves ${payload.moves.join(' ')}` : ''}`);
      const line = await until((output) => output.startsWith('bestmove '), () => command(`go movetime ${payload.movetime}`), payload.movetime + 10_000);
      self.postMessage({ id, value: line.split(/\s+/)[1] });
    }
  } catch (error) { self.postMessage({ id, error: error.message || 'AI 엔진 오류예요.' }); }
};
