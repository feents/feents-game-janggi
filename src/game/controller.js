import { INITIAL_SETTINGS, UNLIMITED_UNDO } from '../settings.js';
import { initialFen, piecesFromFen, moveRecord, rulesVariant, parseMove } from './position-codec.js';
import { availableTime, completeTurn, consumeTime, createClocks } from './clock.js';
import { difficultyProfile } from '../engine/difficulty.js';
import { advancePosition, historySnapshot } from './history.js';

const clone = (value) => structuredClone(value);
export const ACTIVE_PHASES = ['humanTurn', 'aiThinking', 'applyingMove'];

function freshState(settings) {
  const fen = initialFen(settings), clocks = createClocks(settings);
  const state = { gameId: 0, settings: { ...settings }, phase: 'idle', initialFen: fen, fen, turn: 'cho', pieces: piecesFromFen(fen, settings.playerSide),
    captured: [], moves: [], records: [], legalMoves: [], check: false, bikjang: false, result: '*', reason: '',
    clocks, displayClocks: clone(clocks), turnStartedAt: null, undoUsed: 0, canUndo: false, error: '' };
  return { ...state, history: [historySnapshot(state, clocks)] };
}

export class GameController {
  constructor({ createEngine, now = () => Date.now(), supportError = () => '' }) {
    this.createEngine = createEngine;
    this.now = now;
    this.supportError = supportError;
    this.state = freshState(INITIAL_SETTINGS);
    this.listeners = new Set();
    this.frames = [];
    this.generation = 0;
  }

  subscribe = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.state;

  update(patch) {
    this.state = { ...this.state, ...patch };
    this.state.canUndo = ['humanTurn', 'aiThinking'].includes(this.state.phase) && this.frames.length > 0
      && (this.state.settings.undoCount === UNLIMITED_UNDO || this.state.undoUsed < this.state.settings.undoCount);
    for (const listener of this.listeners) listener();
  }

  stopEngines() { this.rules?.destroy(); this.ai?.destroy(); this.rules = null; this.ai = null; }
  destroy() { this.generation++; this.stopEngines(); }

  suspend() {
    if (['preparing', ...ACTIVE_PHASES].includes(this.state.phase)) {
      this.fail(new Error('화면을 떠나 대국을 멈췄어요. 다시 시도를 누르면 이어서 둘 수 있어요.'));
    } else this.destroy();
  }

  positionPatch(position) {
    const saved = this.state.history[this.state.moves.length];
    return { ...position, pieces: saved.pieces, captured: saved.captured };
  }

  async prepare() {
    const gen = ++this.generation;
    this.stopEngines();
    this.update({ phase: 'preparing', turnStartedAt: null, error: '' });
    try {
      const unsupported = this.supportError();
      if (unsupported) throw new Error(unsupported);
      this.rules = this.createEngine('rules');
      this.ai = this.createEngine('ai');
      const variant = rulesVariant(this.state.settings);
      const [position] = await Promise.all([
        this.rules.request('init', { variant, fen: this.state.initialFen, moves: this.state.moves }),
        this.ai.request('init', { variant, skill: difficultyProfile(this.state.settings.aiLevel).skill }),
      ]);
      if (gen !== this.generation) return;
      this.update(this.positionPatch(position));
      if (position.result !== '*') this.finish(position.result, position.reason);
      else this.enterTurn();
    } catch (error) { if (gen === this.generation) this.fail(error); }
  }

  async start(settings) {
    this.frames = [];
    this.update({ ...freshState(settings), gameId: this.state.gameId + 1 });
    await this.prepare();
  }

  enterTurn() {
    this.update({ phase: this.state.turn === this.state.settings.playerSide ? 'humanTurn' : 'aiThinking',
      turnStartedAt: this.now(), displayClocks: clone(this.state.clocks) });
    if (this.state.phase === 'aiThinking') this.search();
  }

  clocksAt(now) {
    const clocks = clone(this.state.clocks);
    if (this.state.turnStartedAt !== null) {
      clocks[this.state.turn] = consumeTime(clocks[this.state.turn], now - this.state.turnStartedAt, this.state.settings.byoSeconds);
    }
    return clocks;
  }

  tick() {
    if (!['humanTurn', 'aiThinking'].includes(this.state.phase)) return;
    const displayClocks = this.clocksAt(this.now());
    if (displayClocks[this.state.turn].expired) {
      this.finish(this.state.turn === 'cho' ? '0-1' : '1-0', 'timeout');
    } else this.update({ displayClocks });
  }

  async search() {
    const gen = this.generation;
    try {
      const budget = availableTime(this.clocksAt(this.now())[this.state.turn], this.state.settings.byoSeconds);
      const movetime = Math.max(1, Math.min(difficultyProfile(this.state.settings.aiLevel).movetime, Math.floor(budget - 150)));
      const move = await this.ai.request('search', { fen: this.state.initialFen, moves: [...this.state.moves], movetime }, movetime + 15_000);
      if (gen !== this.generation || this.state.phase !== 'aiThinking') return;
      if (!this.state.legalMoves.includes(move)) throw new Error('AI 응답과 현재 장기판이 일치하지 않아요. 다시 시도해 주세요.');
      await this.makeMove(move, false);
    } catch (error) { if (gen === this.generation) this.fail(error); }
  }

  async makeMove(move, human = true) {
    if (this.state.phase !== (human ? 'humanTurn' : 'aiThinking') || !this.state.legalMoves.includes(move)) return false;
    const gen = this.generation;
    const before = this.state;
    const clocks = this.clocksAt(this.now());
    if (clocks[before.turn].expired) { this.tick(); return false; }
    const record = moveRecord(move, before.pieces, before.turn);
    this.update({ phase: 'applyingMove', clocks, displayClocks: clocks, turnStartedAt: null });
    try {
      const position = await this.rules.request('move', { move });
      if (gen !== this.generation) return false;
      if (human) this.frames.push({ index: before.moves.length, clocks: clone(before.clocks) });
      clocks[before.turn] = completeTurn(clocks[before.turn], before.settings.byoSeconds);
      const next = advancePosition(before, position, move, before.settings.playerSide);
      this.update({ ...next, moves: [...before.moves, move], records: [...before.records, record],
        history: [...before.history, historySnapshot(next, clocks, move)], clocks, displayClocks: clone(clocks) });
      if (position.result !== '*') this.finish(position.result, position.reason);
      else this.enterTurn();
      return true;
    } catch (error) { if (gen === this.generation) this.fail(error); return false; }
  }

  pass() {
    const move = this.state.legalMoves.find((item) => parseMove(item).pass);
    if (move) return this.makeMove(move);
    return Promise.resolve(false);
  }

  async undo() {
    if (!this.state.canUndo) return;
    const frame = this.frames.pop();
    this.generation++;
    this.stopEngines();
    this.update({ history: this.state.history.slice(0, frame.index + 1), moves: this.state.moves.slice(0, frame.index), records: this.state.records.slice(0, frame.index),
      clocks: clone(frame.clocks), displayClocks: clone(frame.clocks), undoUsed: this.state.undoUsed + 1, turnStartedAt: null });
    await this.prepare();
  }

  finish(result, reason) {
    this.generation++;
    const clocks = this.clocksAt(this.now());
    this.stopEngines();
    this.update({ result, reason, phase: 'finished', legalMoves: [], turnStartedAt: null, clocks, displayClocks: clocks });
  }

  resign() {
    if (this.state.phase === 'idle' || this.state.phase === 'finished') return;
    this.finish(this.state.settings.playerSide === 'cho' ? '0-1' : '1-0', 'resign');
  }

  fail(error) {
    const clocks = this.clocksAt(this.now());
    this.generation++;
    this.stopEngines();
    this.update({ phase: 'engineError', error: error.message, turnStartedAt: null, clocks, displayClocks: clocks });
  }
}

export function resultText(state) {
  if (state.result === '*') return '';
  const reason = { checkmate: '외통', material: '기물 점수', bikjang: '빅장 수용', 'double-pass': '양쪽 한수쉼', 'no-legal-move': '둘 수 있는 수 없음', timeout: '시간 초과', resign: '기권' }[state.reason] || '대국 종료';
  if (state.result === '1/2-1/2') return `무승부 · ${reason}`;
  const winner = state.result === '1-0' ? 'cho' : 'han';
  return `${winner === state.settings.playerSide ? '승리' : '패배'} · ${reason}`;
}
