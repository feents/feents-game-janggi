import { useEffect, useRef } from 'react';
import { ArrowRight, BookOpen, Flag, Handshake, Trophy, X } from 'lucide-react';
import { resultText } from '../game/controller.js';

export default function ResultDialog({ game, scores, onClose, onReview, onNewGame }) {
  const dialogRef = useRef(null);
  const [title, reason] = resultText(game).split(' · ');
  const Icon = title === '승리' ? Trophy : title === '무승부' ? Handshake : Flag;
  useEffect(() => {
    const dialog = dialogRef.current, previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    // 마지막 착수·회수 이동이 보인 뒤 결과를 띄운다.
    const timer = setTimeout(() => { dialog.showModal(); document.body.style.overflow = 'hidden'; }, 320);
    return () => { clearTimeout(timer); dialog.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialogRef} className={`result-dialog result-dialog--${title === '승리' ? 'win' : title === '무승부' ? 'draw' : 'loss'}`} aria-labelledby="result-title" aria-describedby="result-description" onCancel={event => { event.preventDefault(); onClose(); }}>
    <button className="icon-button result-dialog__close" aria-label="대국 결과 닫기" onClick={onClose}><X size={21} /></button>
    <div className="result-icon"><Icon size={32} strokeWidth={1.5} /></div>
    <span className="eyebrow">대국 종료</span>
    <h2 id="result-title">{title}</h2>
    <p id="result-description">종료 사유 · {reason}</p>
    <div className="result-scores"><div><span className="side-badge side-badge--cho">초</span><strong>{scores.cho.total}</strong><span>점</span></div><span>최종 기물 점수</span><div><span className="side-badge side-badge--han">한</span><strong>{scores.han.total}</strong><span>점</span></div></div>
    <p className="result-detail">총 {game.moves.length}수 · {game.settings.aiLevel} AI와의 한 판</p>
    <div className="result-dialog__actions"><button className="button button--primary" onClick={onReview}><BookOpen size={17} />복기하기</button><button className="button button--secondary" onClick={onNewGame}>새 게임 시작<ArrowRight size={17} /></button></div>
  </dialog>;
}
