import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';

export default function ReviewControls({ index, total, playing, onSeek, onPlay, onClose }) {
  return <div className="review-controls" aria-label="복기 조작">
    <div className="review-heading"><strong>복기</strong><span>{index === 0 ? '처음 배치' : `${index}수`} / {total}수</span><button className="icon-button" onClick={onClose} aria-label="복기 종료"><X size={17} /></button></div>
    <input type="range" min="0" max={total} value={index} disabled={!total} aria-label="복기 수 선택" aria-valuetext={`${index}수 / ${total}수`} onChange={event => onSeek(Number(event.target.value))} />
    <div className="review-buttons">
      <button className="icon-button" disabled={index === 0} onClick={() => onSeek(0)} aria-label="처음 배치"><ChevronFirst size={19} /></button>
      <button className="icon-button" disabled={index === 0} onClick={() => onSeek(index - 1)} aria-label="이전 수"><ChevronLeft size={19} /></button>
      <button className="button button--secondary" disabled={!total} onClick={onPlay}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? '일시정지' : '자동 재생'}</button>
      <button className="icon-button" disabled={index === total} onClick={() => onSeek(index + 1)} aria-label="다음 수"><ChevronRight size={19} /></button>
      <button className="icon-button" disabled={index === total} onClick={() => onSeek(total)} aria-label="마지막 수"><ChevronLast size={19} /></button>
    </div>
  </div>;
}
