import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Clock3, SlidersHorizontal, X } from 'lucide-react';
import { AI_LEVELS, FORMATIONS, SIDES, UNLIMITED_UNDO, changePlayerSide, oppositeSide, timeLabel, undoLabel } from '../settings.js';

function FormationPicker({ owner, side, value, onChange }) {
  return (
    <fieldset className="formation-picker">
      <legend>{owner} 상차림 <span className={`side-badge side-badge--${side}`}>{SIDES[side].short}</span></legend>
      <div className="formation-options">
        {FORMATIONS.map((formation) => (
          <label key={formation} className={`formation-option ${value === formation ? 'is-selected' : ''}`}>
            <input type="radio" name={`${owner}-formation`} value={formation} checked={value === formation} onChange={() => onChange(formation)} />
            <span className="formation-pieces" aria-hidden="true">
              {[...formation].map((piece, index) => <span key={index} className={index === 2 ? 'piece-after-palace' : ''}>{piece}</span>)}
            </span>
            <span className="formation-name">{formation}<Check size={12} aria-hidden="true" /></span>
          </label>
        ))}
      </div>
      <p className="field-hint">각 진영에서 바라본 왼쪽부터</p>
    </fieldset>
  );
}

function RangeField({ id, label, value, min, max, step = 1, display, ends, onChange }) {
  return (
    <div className="range-field">
      <div className="range-heading"><label htmlFor={id}>{label}</label><output htmlFor={id}>{display}</output></div>
      <div className="range-track">
        <span className="range-track__fill" style={{ width: `${(value - min) / (max - min) * 100}%` }} aria-hidden="true" />
        <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={display} onChange={(event) => onChange(Number(event.target.value))} />
      </div>
      <div className="range-ends" aria-hidden="true"><span>{ends[0]}</span><span>{ends[1]}</span></div>
    </div>
  );
}

function RuleSwitch({ id, label, checked, description, onChange }) {
  return (
    <div className="rule-field">
      <div><label htmlFor={id}>{label}</label><button id={id} className="switch" role="switch" aria-checked={checked} aria-label={label} aria-describedby={`${id}-description`} type="button" onClick={() => onChange(!checked)}><span /></button></div>
      <p className="field-hint" id={`${id}-description`}>{description || `${label} ${checked ? '사용' : '사용 안 함'}`}</p>
    </div>
  );
}

export default function NewGameDialog({ settings, onClose, onStart }) {
  const [draft, setDraft] = useState({ ...settings });
  const dialogRef = useRef(null);
  const aiSide = oppositeSide(draft.playerSide);
  const update = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));

  function keepFocusInDialog(event) {
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button, input, select')]
      .filter((element) => !element.disabled && element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="new-game-dialog" aria-labelledby="new-game-title" aria-describedby="new-game-description" onKeyDown={keepFocusInDialog} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <form className="new-game-form" onSubmit={(event) => { event.preventDefault(); onStart(draft); }}>
        <div className="dialog-heading">
          <div><span className="eyebrow">나만의 한 판</span><h2 id="new-game-title">새 게임 설정</h2><p id="new-game-description">진영부터 대국 시간까지, 편하게 골라보세요.</p></div>
          <button type="button" className="icon-button" aria-label="새 게임 설정 닫기" onClick={onClose}><X size={21} /></button>
        </div>
        <div className="dialog-content">
          <section className="setup-section" aria-labelledby="sides-heading">
            <h3 id="sides-heading"><span>01</span>진영과 상차림</h3>
            <fieldset className="side-picker">
              <legend>내 진영</legend>
              <div className="side-options">
                {Object.entries(SIDES).map(([key, side]) => (
                  <label key={key} className={`side-option ${draft.playerSide === key ? 'is-selected' : ''}`}>
                    <input type="radio" name="player-side" value={key} checked={draft.playerSide === key} onChange={() => setDraft(previous => changePlayerSide(previous, key))} />
                    <span className={`side-piece side-piece--${key}`} aria-hidden="true">{side.short}</span>
                    <span><strong>{side.label}</strong><small>{side.order}</small></span>
                    <span className="radio-indicator" aria-hidden="true" />
                  </label>
                ))}
              </div>
              <p className="field-hint">AI는 {SIDES[aiSide].label}로 함께해요.</p>
            </fieldset>
            <div className="formations-grid">
              <FormationPicker owner="내" side={draft.playerSide} value={draft.playerFormation} onChange={(value) => update('playerFormation', value)} />
              <FormationPicker owner="AI" side={aiSide} value={draft.aiFormation} onChange={(value) => update('aiFormation', value)} />
            </div>
          </section>
          <section className="setup-section" aria-labelledby="time-heading">
            <h3 id="time-heading"><span>02</span>대국 시간 <Clock3 size={16} /><small>플레이어마다 동일하게 적용</small></h3>
            <RangeField id="main-time" label="기본 시간" value={draft.minutes} min={0} max={60} step={5} display={timeLabel(draft.minutes)} ends={['초읽기만', '60분']} onChange={(value) => update('minutes', value)} />
            <div className="two-columns">
              <RangeField id="byo-seconds" label="초읽기 시간" value={draft.byoSeconds} min={10} max={60} step={10} display={`${draft.byoSeconds}초`} ends={['10초', '60초']} onChange={(value) => update('byoSeconds', value)} />
              <RangeField id="byo-count" label="초읽기 횟수" value={draft.byoCount} min={1} max={5} display={`${draft.byoCount}회`} ends={['1회', '5회']} onChange={(value) => update('byoCount', value)} />
            </div>
          </section>
          <section className="setup-section" aria-labelledby="rules-heading">
            <h3 id="rules-heading"><span>03</span>AI와 대국 규칙 <SlidersHorizontal size={16} /></h3>
            <div className="two-columns final-settings">
              <div className="difficulty-field">
                <label htmlFor="ai-level">AI 실력</label>
                <div className="select-wrap"><select id="ai-level" value={draft.aiLevel} onChange={(event) => update('aiLevel', event.target.value)}>{AI_LEVELS.map((level) => <option key={level}>{level}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></div>
                <p className="field-hint">18급~9단 · 게임 내 상대 난이도</p>
              </div>
              <RuleSwitch id="bigjang-rule" label="빅장 룰" checked={draft.bigjang} description="궁이 마주 보면 해소하거나 한수쉼으로 무승부를 받아요." onChange={(value) => update('bigjang', value)} />
            </div>
            <div className="two-columns additional-rules">
              <RuleSwitch id="material-victory-rule" label="기물승" checked={draft.materialVictory} description="한쪽 기물이 덤을 빼고 10점 미만이면, 한 덤 1.5점을 포함한 총점으로 승패를 가려요." onChange={(value) => update('materialVictory', value)} />
              <RuleSwitch id="repetition-limit-rule" label="반복수" checked={draft.repetitionLimit} description="말 배치와 차례가 같은 국면이 세 번째 나타나는 수를 금지해요." onChange={(value) => update('repetitionLimit', value)} />
            </div>
            <div className="undo-setting">
              <RangeField id="undo-count" label="무르기 횟수" value={draft.undoCount} min={0} max={UNLIMITED_UNDO} display={undoLabel(draft.undoCount)} ends={['0회', '10회 · 무제한']} onChange={(value) => update('undoCount', value)} />
              <p className="field-hint">0회는 무르기 사용 안 함, 마지막 눈금은 무제한</p>
            </div>
          </section>
        </div>
        <div className="dialog-footer">
          <p>AI는 이 브라우저에서 생각해요.<br />양쪽이 연속으로 한수쉼을 하면 무승부예요.</p>
          <div><button type="button" className="button button--secondary" onClick={onClose}>취소</button><button type="submit" className="button button--primary">시작하기<ArrowRight size={17} /></button></div>
        </div>
      </form>
    </dialog>
  );
}
