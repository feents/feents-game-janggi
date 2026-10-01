export const DEFAULT_FORMATIONS = { cho: '상마상마', han: '마상마상' };

export const INITIAL_SETTINGS = {
  playerSide: 'cho',
  playerFormation: DEFAULT_FORMATIONS.cho,
  aiFormation: DEFAULT_FORMATIONS.han,
  bigjang: false,
  materialVictory: true,
  repetitionLimit: true,
  minutes: 5,
  byoCount: 3,
  byoSeconds: 30,
  aiLevel: '18급',
  undoCount: 3,
};

// 0~10회 다음의 마지막 슬라이더 눈금을 무제한으로 사용한다.
export const UNLIMITED_UNDO = 11;

export function undoLabel(count) {
  return count === UNLIMITED_UNDO ? '무제한' : `${count}회`;
}

export const SIDES = {
  cho: { label: '초나라', short: '초', order: '선공' },
  han: { label: '한나라', short: '한', order: '후공' },
};

export const FORMATIONS = ['상마상마', '마상마상', '마상상마', '상마마상'];
export const AI_LEVELS = [
  ...Array.from({ length: 18 }, (_, index) => `${18 - index}급`),
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}단`),
];

export function oppositeSide(side) {
  return side === 'cho' ? 'han' : 'cho';
}

// 상차림은 사용자/AI 역할이 아니라 초·한 진영에 따라 유지한다.
export function changePlayerSide(settings, playerSide) {
  if (settings.playerSide === playerSide) return settings;
  return { ...settings, playerSide, playerFormation: settings.aiFormation, aiFormation: settings.playerFormation };
}

export function timeLabel(minutes) {
  return minutes === 0 ? '초읽기만' : `${minutes}분`;
}
