export function createClocks(settings) {
  const clock = { mainMs: settings.minutes * 60_000, periods: settings.byoCount, periodMs: settings.byoSeconds * 1000 };
  return { cho: { ...clock }, han: { ...clock } };
}

// 전체 경과 시간을 한 번에 정산하므로 백그라운드 타이머가 늦어져도 시간이 늘어나지 않는다.
export function consumeTime(clock, elapsed, byoSeconds) {
  const next = { ...clock };
  let remaining = Math.max(0, elapsed);
  const mainUsed = Math.min(next.mainMs, remaining);
  next.mainMs -= mainUsed;
  remaining -= mainUsed;
  if (next.mainMs === 0) {
    next.periodMs -= remaining;
    while (next.periodMs <= 0 && next.periods > 0) {
      next.periods--;
      if (next.periods > 0) next.periodMs += byoSeconds * 1000;
    }
  }
  return { ...next, periodMs: Math.max(0, next.periodMs), expired: next.mainMs === 0 && next.periods === 0 };
}

export function completeTurn(clock, byoSeconds) {
  return { ...clock, periodMs: byoSeconds * 1000 };
}

export function availableTime(clock, byoSeconds) {
  return clock.mainMs + clock.periodMs + Math.max(0, clock.periods - 1) * byoSeconds * 1000;
}

export function formatClock(clock) {
  const seconds = Math.ceil((clock.mainMs > 0 ? clock.mainMs : clock.periodMs) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
