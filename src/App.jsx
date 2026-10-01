import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, BookOpen, Flag, RotateCcw, SkipForward, Undo2 } from 'lucide-react';
import Header from './components/Header.jsx';
import { JanggiBoard, PlayerBar } from './components/Board.jsx';
import NewGameDialog from './components/NewGameDialog.jsx';
import ResultDialog from './components/ResultDialog.jsx';
import ReviewControls from './components/ReviewControls.jsx';
import { useCaptureMotion } from './components/useCaptureMotion.js';
import { SIDES, UNLIMITED_UNDO, oppositeSide, undoLabel } from './settings.js';
import { calculateMaterialScores } from './material-score.js';
import { GameController, resultText } from './game/controller.js';
import { parseMove } from './game/position-codec.js';
import { EngineClient, engineSupportError } from './engine/client.js';

export default function App() {
  const [controller] = useState(() => new GameController({ createEngine: kind => new EngineClient(kind), supportError: engineSupportError }));
  const game = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [selected, setSelected] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [resultDismissed, setResultDismissed] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(null);
  const [playing, setPlaying] = useState(false);
  const boardRef = useRef(null), startButtonRef = useRef(null), recordListRef = useRef(null);
  const { settings } = game;
  const reviewing = reviewIndex !== null && game.phase === 'finished';
  const position = reviewing ? game.history[Math.min(reviewIndex, game.moves.length)] : game;
  const { pieces, captured } = position;
  const clocks = reviewing ? position.clocks : game.displayClocks;
  const scores = calculateMaterialScores(pieces);
  const finalScores = calculateMaterialScores(game.pieces);
  const finished = game.phase === 'finished';
  const waiting = game.phase === 'idle';
  const humanTurn = game.phase === 'humanTurn' && !reviewing;
  const showResult = finished && !resultDismissed && !isSettingUp && !reviewing;
  const destinations = selected && humanTurn ? game.legalMoves.map(parseMove).filter(move => move.from === selected && !move.pass).map(move => move.to) : [];
  const passMove = game.legalMoves.find(move => parseMove(move).pass);
  const undoRemaining = settings.undoCount === UNLIMITED_UNDO ? UNLIMITED_UNDO : Math.max(0, settings.undoCount - game.undoUsed);
  const phaseMessage = reviewing ? (reviewIndex === 0 ? '처음 배치예요. 다음 수를 눌러 대국을 돌아보세요.' : `${reviewIndex}수 · ${SIDES[game.records[reviewIndex - 1].side].label} ${game.records[reviewIndex - 1].label}`)
    : game.phase === 'preparing' ? '장기 엔진을 준비하고 있어요. 잠시만 기다려 주세요.'
      : game.phase === 'engineError' ? '엔진 연결이 중단되어 시간을 멈췄어요.'
        : finished ? resultText(game)
          : game.phase === 'aiThinking' ? 'AI가 다음 수를 생각하고 있어요.'
            : game.phase === 'applyingMove' ? '착수를 확인하고 있어요.'
              : game.bikjang ? '빅장이에요. 궁의 대면을 해소하거나 한수쉼으로 무승부를 받아 주세요.'
                : game.check ? '장군이에요. 궁을 보호하는 수를 두세요.' : '내 차례예요. 말을 선택하고 이동할 곳을 눌러 주세요.';
  useCaptureMotion(boardRef, pieces, captured, game.gameId);

  useEffect(() => {
    const timer = setInterval(() => controller.tick(), 100);
    const onVisibility = () => controller.tick();
    const onExit = () => controller.suspend();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onExit);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', onExit); controller.destroy(); };
  }, [controller]);
  useEffect(() => { setSelected(null); setActionMessage(''); }, [game.fen, game.phase, reviewIndex]);
  useEffect(() => {
    if (!isSettingUp && !showResult) (waiting ? startButtonRef : boardRef).current?.focus();
  }, [isSettingUp, showResult, waiting]);
  useEffect(() => {
    const list = recordListRef.current;
    if (!list) return;
    if (!reviewing) list.scrollTop = list.scrollHeight;
    else {
      const row = list.querySelector(`[data-ply="${reviewIndex}"]`);
      if (row) {
        const delta = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
        if (delta < 0) list.scrollTop += delta;
        else if (delta + row.offsetHeight > list.clientHeight) list.scrollTop += delta + row.offsetHeight - list.clientHeight;
      } else if (reviewIndex === 0) list.scrollTop = 0;
    }
  }, [game.records.length, reviewing, reviewIndex]);
  useEffect(() => {
    if (!playing || !reviewing) return;
    if (reviewIndex === game.moves.length) { setPlaying(false); return; }
    const timer = setTimeout(() => setReviewIndex(index => index === null ? null : Math.min(index + 1, game.moves.length)), 900);
    return () => clearTimeout(timer);
  }, [playing, reviewing, reviewIndex, game.moves.length]);

  function selectSquare(square) {
    if (!humanTurn) return;
    if (selected && destinations.includes(square)) { controller.makeMove(`${selected}${square}`); setSelected(null); return; }
    const piece = pieces.find(item => item.square === square);
    if (piece?.side === settings.playerSide) { setSelected(selected === square ? null : square); setActionMessage(''); }
    else { setSelected(null); setActionMessage('이동할 수 있는 점이 표시된 곳을 선택해 주세요.'); }
  }
  function startGame(nextSettings) {
    setIsSettingUp(false); setReviewIndex(null); setPlaying(false); setResultDismissed(false);
    controller.start(nextSettings);
  }
  function newGame() {
    setPlaying(false);
    if (!finished && game.phase !== 'engineError') { controller.resign(); setResultDismissed(false); }
    else setIsSettingUp(true);
  }
  function seek(index) { setPlaying(false); setResultDismissed(true); setReviewIndex(index); }
  function closeReview() { setPlaying(false); setReviewIndex(null); }
  function togglePlayback() {
    if (reviewIndex === game.moves.length) setReviewIndex(0);
    setPlaying(value => !value);
  }

  return <>
    <Header />
    <main className={`main-content ${waiting ? 'main-content--waiting' : ''} ${reviewing ? 'main-content--review' : ''}`}>
      <div className={`game-layout ${waiting ? 'game-layout--waiting' : ''}`} inert={waiting} aria-hidden={waiting}>
        <section key={game.gameId} ref={boardRef} className="board-panel" aria-label="대국 화면" tabIndex={-1}>
          <PlayerBar isAI side={oppositeSide(settings.playerSide)} settings={settings} score={scores[oppositeSide(settings.playerSide)]} clock={clocks[oppositeSide(settings.playerSide)]} active={!reviewing && game.phase === 'aiThinking'} captured={captured.filter(piece => piece.capturedBy === oppositeSide(settings.playerSide))} />
          <div className="board-surface"><JanggiBoard settings={settings} pieces={pieces} interactive={humanTurn} selected={selected} destinations={destinations} onSquare={selectSquare} lastMove={reviewing ? position.lastMove : game.moves.at(-1)} checkSide={position.check ? position.turn : null} /></div>
          <PlayerBar side={settings.playerSide} settings={settings} score={scores[settings.playerSide]} clock={clocks[settings.playerSide]} active={humanTurn} captured={captured.filter(piece => piece.capturedBy === settings.playerSide)} />
        </section>
        <div className="game-sidebar">
          <section className="game-controls panel" aria-label="대국 조작과 안내">
            <div className="game-actions" aria-label="대국 조작">
              {finished ? <>
                <button className="button button--secondary" onClick={() => reviewing ? closeReview() : seek(0)}><BookOpen size={17} />{reviewing ? '복기 종료' : '복기하기'}</button>
                <button className="button button--secondary" onClick={() => { closeReview(); setResultDismissed(false); }}>결과 보기</button>
              </> : <>
                <button className="button button--secondary" disabled={!game.canUndo} onClick={() => controller.undo()}><Undo2 size={17} />무르기<span className="action-count">{undoLabel(undoRemaining)}</span></button>
                <button className="button button--secondary" disabled={!humanTurn || !passMove} onClick={() => controller.pass()}><SkipForward size={17} />{game.bikjang ? '빅장 수용' : '한수쉼'}</button>
              </>}
              <button className="button button--secondary game-actions__restart" onClick={newGame}><Flag size={17} />{finished || game.phase === 'engineError' ? '새 게임 시작' : '기권하고 새 게임 시작'}</button>
            </div>
            <p className={`action-message ${position.check ? 'action-message--check' : ''}`} role="status">{actionMessage || phaseMessage}</p>
          </section>
          <aside className="record-panel panel" aria-labelledby="record-title">
            <div className="record-heading"><h2 id="record-title">{reviewing ? '대국 복기' : '기보'}</h2><span>{game.records.length}수</span></div>
            {game.phase === 'engineError' && <div className="game-notice" role="alert"><strong>대국을 잠시 멈췄어요</strong><p>{game.error}</p><button className="button button--secondary" onClick={() => controller.prepare()}><RotateCcw size={16} />다시 시도</button></div>}
            {finished && !reviewing && <div className="game-notice game-notice--result"><strong>{resultText(game)}</strong><p>기보의 수를 누르거나 복기하기로 다시 볼 수 있어요.</p><button className="button button--secondary" onClick={() => seek(0)}><BookOpen size={16} />복기하기</button></div>}
            {reviewing && <ReviewControls index={reviewIndex} total={game.moves.length} playing={playing} onSeek={seek} onPlay={togglePlayback} onClose={closeReview} />}
            {game.records.length ? <ol ref={recordListRef} className="move-list" aria-label="대국 기보">{game.records.map((record, index) => <li key={`${index}-${record.move}`} data-ply={index + 1} className={reviewIndex === index + 1 ? 'is-current' : ''}>
              <button className="record-move" disabled={!finished} aria-label={`${index + 1}수 ${SIDES[record.side].short} ${record.label}`} aria-current={reviewIndex === index + 1 ? 'step' : undefined} onClick={() => seek(index + 1)}><span className="move-number">{index + 1}</span><span className={`side-badge side-badge--${record.side}`}>{SIDES[record.side].short}</span><span>{record.label}</span></button>
            </li>)}</ol> : <div className="empty-record"><BookOpen size={27} strokeWidth={1.2} /><p>아직 놓인 수가 없어요</p><span>{finished ? '처음 배치부터 다시 살펴볼 수 있어요.' : '한 수 한 수, 이곳에 기록돼요.'}</span></div>}
            <div className="game-rules-summary">빅장 {settings.bigjang ? '켬' : '끔'} · 기물승 {settings.materialVictory ? '켬' : '끔'} · 반복수 {settings.repetitionLimit ? '켬' : '끔'}</div>
          </aside>
        </div>
      </div>
      {waiting && <div className="welcome-overlay"><section className="welcome-card" aria-labelledby="welcome-title"><h1 id="welcome-title">장기, 한 수의 여유.</h1><p>진영과 상차림을 고르고,<br />나에게 맞는 AI와 한 판을 준비해 보세요.</p><button ref={startButtonRef} className="button button--primary" onClick={() => setIsSettingUp(true)}>새 게임 시작<ArrowRight size={18} /></button></section></div>}
    </main>
    {showResult && <ResultDialog game={game} scores={finalScores} onClose={() => setResultDismissed(true)} onReview={() => seek(0)} onNewGame={() => { setResultDismissed(true); setIsSettingUp(true); }} />}
    {isSettingUp && <NewGameDialog settings={settings} onClose={() => setIsSettingUp(false)} onStart={startGame} />}
  </>;
}
