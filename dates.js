// 새 결과 날짜는 이 목록에만 추가한다. 기존 보고서에도 같은 날짜 탭이 표시된다.
const DATES = [
  { date: '20260929', label: '2026년 09월 29일' },
  { date: '20260930', label: '2026년 09월 30일' },
  { date: '20261001', label: '2026년 10월 1일' },
];

let dateAreaEvents;

function setDateArea() {
  const area = document.querySelector('[data-date-area]');
  if (!area) return;
  dateAreaEvents?.abort();
  dateAreaEvents = new AbortController();
  const groups = [...document.querySelectorAll('[data-requirement-group]')];
  const panels = [...document.querySelectorAll('[data-date-panel]')];

  area.replaceChildren(...DATES.map(({ date, label }) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `date-tab-${date}`;
    tab.setAttribute('role', 'tab');
    tab.dataset.date = date;
    tab.textContent = label;
    if (panels.some(panel => panel.dataset.datePanel === date)) {
      tab.setAttribute('aria-controls', `requirements-${date} date-panel-${date}`);
    }
    return tab;
  }));
  const dateTabs = [...area.querySelectorAll('[data-date]')];

  function selectRequirement(tab) {
    const group = tab.closest('[data-requirement-group]');
    const panel = panels.find(item => item.dataset.datePanel === group.dataset.requirementGroup);
    if (!panel) return;
    group.querySelectorAll('[role="tab"]').forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    panel.querySelectorAll('[data-requirement-panel]').forEach(item => {
      item.hidden = item.id !== tab.dataset.requirement;
    });
  }

  function selectDate(tab) {
    const date = tab.dataset.date;
    // 과거 보고서에 없는 새 날짜는 해당 날짜의 결과 파일에서 연다.
    if (!panels.some(panel => panel.dataset.datePanel === date)) {
      window.location.assign(new URL(`result_${date}.html`, document.baseURI).href);
      return;
    }
    dateTabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    groups.forEach(group => {
      group.hidden = group.dataset.requirementGroup !== date;
      if (!group.hidden) {
        const active = group.querySelector('[aria-selected="true"]') || group.querySelector('[role="tab"]');
        if (active) selectRequirement(active);
      }
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.datePanel !== date; });
  }

  for (const list of [area, ...groups]) {
    list.addEventListener('click', event => {
      const tab = event.target.closest('[role="tab"]');
      if (!tab || !list.contains(tab)) return;
      tab.hasAttribute('data-date') ? selectDate(tab) : selectRequirement(tab);
    }, { signal: dateAreaEvents.signal });
    list.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      const index = tabs.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    }, { signal: dateAreaEvents.signal });
  }

  const initial = dateTabs.find(tab => tab.dataset.date === area.dataset.currentDate) || dateTabs[0];
  if (initial) selectDate(initial);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setDateArea, { once: true });
} else {
  setDateArea();
}
