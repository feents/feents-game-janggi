export class EngineClient {
  constructor(kind) {
    this.kind = kind;
    this.pending = new Map();
    this.serial = 0;
    this.closed = false;
    const base = `${import.meta.env.BASE_URL}engine/`;
    this.worker = new Worker(`${base}${kind}-worker.js`, kind === 'rules' ? { type: 'module' } : undefined);
    this.worker.onmessage = ({ data }) => {
      const request = this.pending.get(data.id);
      if (!request) return;
      clearTimeout(request.timeout);
      this.pending.delete(data.id);
      data.error ? request.reject(new Error(data.error)) : request.resolve(data.value);
    };
    this.worker.onerror = () => this.fail(new Error('장기 엔진을 실행할 수 없어요. 새로고침하거나 다시 시도해 주세요.'));
    this.worker.onmessageerror = () => this.fail(new Error('장기 엔진 응답을 읽을 수 없어요.'));
  }

  fail(error) {
    this.failedError = error;
    for (const request of this.pending.values()) { clearTimeout(request.timeout); request.reject(error); }
    this.pending.clear();
  }

  request(type, payload = {}, timeoutMs = type === 'init' && this.kind === 'ai' ? 60_000 : 20_000) {
    if (this.closed) return Promise.reject(new Error('종료된 엔진이에요.'));
    if (this.failedError) return Promise.reject(this.failedError);
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('엔진 응답이 지연됐어요. 다시 시도해 주세요.'));
        this.destroy();
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.worker.postMessage({ id, type, payload });
    });
  }

  destroy() {
    if (this.closed) return;
    this.closed = true;
    this.fail(new Error('엔진 요청이 취소됐어요.'));
    const worker = this.worker;
    const timer = setTimeout(() => worker.terminate(), 500);
    worker.onmessage = ({ data }) => { if (data.disposed) { clearTimeout(timer); worker.terminate(); } };
    worker.postMessage({ type: 'dispose' });
  }
}

export function engineSupportError() {
  if (!globalThis.WebAssembly) return '이 브라우저는 WebAssembly를 지원하지 않아요.';
  if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    return 'AI 실행에 필요한 공유 메모리를 사용할 수 없어요. 최신 Chrome·Edge·Firefox·Safari에서 열어 주세요. 운영 서버는 HTTPS와 COOP·COEP 설정이 필요해요.';
  }
  return '';
}
