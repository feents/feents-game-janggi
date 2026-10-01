import { Bot, UserRound } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { pieceGlyph, pieceName } from '../board-position.js';
import { JANGGI_GLYPHS } from '../assets/janggi-glyphs.js';
import { SIDES } from '../settings.js';
import { parseMove, screenToSquare, squareToScreen } from '../game/position-codec.js';
import { formatClock } from '../game/clock.js';
import { usePieceMotion } from './usePieceMotion.js';

const OCTAGON = '-0.414,-1 0.414,-1 1,-0.414 1,0.414 0.414,1 -0.414,1 -1,0.414 -1,-0.414';

function BoardPiece({ piece, x, y, miniature = false }) {
  const motionRef = usePieceMotion(x, y, miniature);
  const size = piece.type === 'general' ? 26 : ['soldier', 'guard'].includes(piece.type) ? 16 : 20;
  const label = `${SIDES[piece.side].label} ${pieceName(piece)}, ${piece.column + 1}열 ${piece.row + 1}행`;
  const glyph = JANGGI_GLYPHS[piece.side][piece.type];

  return (
    <g ref={motionRef} className={`board-piece board-piece--${piece.side} board-piece--${piece.type}`} style={{ transform: `translate(${x}px, ${y}px)` }} data-piece-id={miniature ? undefined : piece.id} data-side={piece.side} data-owner={piece.owner} data-type={piece.type} data-column={piece.column} data-row={piece.row}>
      <title>{label}</title>
      <polygon className="piece-edge" points={OCTAGON} transform={`translate(0 2) scale(${size})`} />
      <polygon className="piece-face" points={OCTAGON} transform={`scale(${size})`} />
      <polygon className="piece-rim" points={OCTAGON} transform={`scale(${size - 3})`} />
      <svg className="piece-glyph" x={-size * 0.68} y={-size * 0.68} width={size * 1.36} height={size * 1.36} viewBox={glyph.viewBox} aria-hidden="true" data-glyph={pieceGlyph(piece)} data-script={piece.side === 'han' ? 'haeseo' : 'choseo'}>
        <path d={glyph.d} stroke="currentColor" strokeWidth={glyph.strokeWidth} strokeLinejoin="round" />
      </svg>
    </g>
  );
}

// 장기는 강 없이 9개의 세로선과 10개의 가로선, 양쪽 궁성으로 구성된다.
export function JanggiBoard({ settings, pieces, interactive = false, selected, destinations = [], onSquare, lastMove, checkSide }) {
  const id = useId();
  const svgRef = useRef(null);
  const [focusCell, setFocusCell] = useState({ column: 4, row: 8 });
  const grainId = `${id}-wood-grain`;
  const titleId = `${id}-board-title`;
  const descriptionId = `${id}-board-description`;
  const columns = Array.from({ length: 9 }, (_, index) => 40 + index * 48);
  const rows = Array.from({ length: 10 }, (_, index) => 38 + index * 48);
  const marks = [[1, 2], [7, 2], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
    [0, 6], [2, 6], [4, 6], [6, 6], [8, 6], [1, 7], [7, 7]];
  const previous = lastMove ? parseMove(lastMove) : null;

  function handleKey(event, column, row, square) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (interactive) onSquare?.(square); return; }
    const offset = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!offset) return;
    event.preventDefault();
    const next = { column: Math.max(0, Math.min(8, column + offset[0])), row: Math.max(0, Math.min(9, row + offset[1])) };
    setFocusCell(next);
    svgRef.current.querySelector(`[data-square="${screenToSquare(next.column, next.row, settings.playerSide)}"]`)?.focus();
  }

  return (
    <svg ref={svgRef} className="janggi-board" viewBox="0 0 464 508" role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <title id={titleId}>말이 배치된 나무 장기판</title>
      <metadata>장기 글자 도안: Kadagaden / chess-pieces, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). 글자만 추출하고 크기와 색상 변경. 출처: https://github.com/Kadagaden/chess-pieces. 상세: /licenses/janggi-glyphs.txt</metadata>
      <desc id={descriptionId}>9열 10행의 장기판이에요. 아래는 내 {SIDES[settings.playerSide].label}예요. 방향키로 교차점을 이동하고 Enter 또는 Space로 말과 목적지를 선택해요. 남은 말 {pieces.length}개.</desc>
      <defs>
        <pattern id={grainId} width="464" height="84" patternUnits="userSpaceOnUse">
          <path className="wood-grain" d="M0 8 C90 1 160 17 270 10 S400 3 464 11 M0 22 C120 30 210 12 320 22 S420 29 464 20 M0 44 C100 34 175 52 300 42 S395 37 464 45 M0 63 C80 56 190 71 284 62 S404 55 464 66 M0 77 C125 83 204 70 335 77 S426 82 464 75" />
        </pattern>
      </defs>
      <rect className="board-frame" x="1" y="1" width="462" height="506" rx="10" />
      <rect className="board-wood" x="8" y="8" width="448" height="492" rx="5" />
      <rect x="8" y="8" width="448" height="492" rx="5" fill={`url(#${grainId})`} />
      <g className="board-grid">
        {columns.map((x) => <line key={`x-${x}`} x1={x} y1="38" x2={x} y2="470" />)}
        {rows.map((y) => <line key={`y-${y}`} x1="40" y1={y} x2="424" y2={y} />)}
        <path d="M184 38 280 134 M280 38 184 134 M184 374 280 470 M280 374 184 470" />
      </g>
      <g className="board-marks">
        {marks.map(([col, row]) => <path key={`${col}-${row}`} transform={`translate(${columns[col]} ${rows[row]})`} d="M-4.2 -4.2 4.2 4.2 M4.2 -4.2 -4.2 4.2" />)}
      </g>
      <g className="board-coordinates" aria-hidden="true">
        {columns.map((x, index) => <text key={x} x={x} y="13" textAnchor="middle">{index + 1}</text>)}
        {rows.map((y, index) => <text key={y} x="14" y={y + 3} textAnchor="middle">{index + 1}</text>)}
      </g>
      <g className="move-markers" aria-hidden="true">{previous && [previous.from, previous.to].map((square, index) => {
        const cell = squareToScreen(square, settings.playerSide);
        return <rect key={`${square}-${index}`} className="last-move" x={columns[cell.column] - 22} y={rows[cell.row] - 22} width="44" height="44" rx="7" />;
      })}</g>
      {/* 엔진의 칸 순서가 바뀌어도 SVG 요소를 재삽입하지 않도록 말 ID 순서를 고정한다. */}
      <g className="board-pieces">{[...pieces].sort((a, b) => a.id.localeCompare(b.id)).map((piece) => <BoardPiece key={piece.id} piece={piece} x={columns[piece.column]} y={rows[piece.row]} />)}</g>
      <g className="board-input">{rows.flatMap((y, row) => columns.map((x, column) => {
        const square = screenToSquare(column, row, settings.playerSide);
        const piece = pieces.find((item) => item.column === column && item.row === row);
        const target = destinations.includes(square);
        const checked = piece?.type === 'general' && piece.side === checkSide;
        return <g key={square} role="button" data-square={square} tabIndex={focusCell.column === column && focusCell.row === row ? 0 : -1} aria-disabled={!interactive} aria-pressed={selected === square} aria-label={`${square} ${piece ? `${SIDES[piece.side].short} ${pieceName(piece)}` : '빈자리'}${target ? ', 이동 가능' : ''}${checked ? ', 장군' : ''}`} onClick={() => { setFocusCell({ column, row }); if (interactive) onSquare?.(square); }} onKeyDown={(event) => handleKey(event, column, row, square)}>
          <rect className="board-hitbox" x={x - 23} y={y - 23} width="46" height="46" rx="8" />
          {(selected === square || checked) && <circle className={checked ? 'checked-ring' : 'selected-ring'} cx={x} cy={y} r={piece?.type === 'general' ? 28 : 23} />}
          {target && <circle className={piece ? 'capture-target' : 'move-target'} cx={x} cy={y} r={piece ? 22 : 7} />}
        </g>;
      }))}</g>
    </svg>
  );
}

export function PlayerBar({ isAI = false, side, settings, score, clock, active = false, captured = [] }) {
  const Icon = isAI ? Bot : UserRound;
  return (
    <div className={`player-bar ${isAI ? 'player-bar--ai' : ''} ${active ? 'player-bar--active' : ''}`}>
      <span className="player-avatar"><Icon size={20} strokeWidth={1.5} /></span>
      <div className="player-identity">
        <div><strong>{isAI ? 'FEENTS AI' : '나'}</strong><span className={`side-badge side-badge--${side}`}>{SIDES[side].short}</span></div>
        <span>{SIDES[side].order} · {isAI ? `${settings.aiLevel} · ${settings.aiFormation}` : settings.playerFormation}</span>
      </div>
      <div className={`material-score material-score--${side}`} role="group" aria-label={`${SIDES[side].label} 기물 점수`}>
        <span className="material-score__label">기물 점수</span>
        <div className="material-score__value"><strong>{score.total}</strong><span>점</span></div>
        <span className="material-score__detail">{score.bonus ? `기물 ${score.material} + 덤 ${score.bonus}` : '남은 기물 합계'}</span>
      </div>
      <div className={`player-clock ${clock?.mainMs === 0 ? 'player-clock--byo' : ''}`} aria-label={`${SIDES[side].label} 남은 시간`}>
        <span className="clock-value">{clock ? formatClock(clock) : `${String(settings.minutes).padStart(2, '0')}:00`}</span>
        <span>{clock?.mainMs === 0 ? '초읽기 중' : `초읽기 ${settings.byoSeconds}초`} · {clock?.periods ?? settings.byoCount}회</span>
      </div>
      <div className="captured-area" role="group" aria-label={`${isAI ? 'AI가' : '내가'} 잡은 말`}>
        <span className="captured-area__label">잡은 말 <b>{captured.length}</b></span>
        {captured.length ? <div className="captured-pieces">{captured.map(piece => <span key={piece.id} className="captured-piece" data-captured-id={piece.id} role="img" aria-label={`${SIDES[piece.side].label} ${pieceName(piece)}`}>
          <svg viewBox="-23 -23 46 48" aria-hidden="true"><BoardPiece piece={piece} x={0} y={0} miniature /></svg>
        </span>)}</div> : <span className="captured-area__empty">아직 없어요</span>}
      </div>
    </div>
  );
}
