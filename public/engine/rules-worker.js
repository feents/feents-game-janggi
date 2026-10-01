import createRules from './ffish.js';

let board;
const ready = createRules({ locateFile: (file) => new URL(file, import.meta.url).href }).then((ffish) => {
  // 이 바인딩은 Board 생성 또는 설정 로드 때 전역 변형 목록을 초기화한다.
  ffish.loadVariantConfig('');
  return ffish;
});
function snapshot() {
  const result = board.result();
  return {
    fen: board.fen(), turn: board.turn() ? 'cho' : 'han',
    legalMoves: result === '*' ? board.legalMoves().split(' ').filter(Boolean) : [],
    check: board.isCheck(), bikjang: board.isBikjang(),
    result, reason: board.terminationReason(),
  };
}
let queue = Promise.resolve();
self.onmessage = ({ data: { id, type, payload } }) => {
  queue = queue.then(async () => {
    if (type === 'dispose') { board?.delete(); board = undefined; self.postMessage({ disposed: true }); self.close(); return; }
    try {
      const ffish = await ready;
      let value;
      if (type === 'init') {
        if (!ffish.variants().split(' ').includes(payload.variant)) throw new Error('요청한 장기 규칙이 엔진에 없어요.');
        if (ffish.validateFen(payload.fen, payload.variant) !== 1) throw new Error('초기 장기판이 올바르지 않아요.');
        board?.delete();
        board = new ffish.Board(payload.variant, payload.fen);
        for (const move of payload.moves || []) if (!board.push(move)) throw new Error('기보를 복원할 수 없어요.');
        value = snapshot();
      } else if (type === 'move') {
        if (!board || !board.push(payload.move)) throw new Error('둘 수 없는 수예요.');
        value = snapshot();
      } else throw new Error('알 수 없는 규칙 요청이에요.');
      self.postMessage({ id, value });
    } catch (error) { self.postMessage({ id, error: error.message || '규칙 엔진 오류예요.' }); }
  });
};
