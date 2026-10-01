export const BOARD_COLUMNS = Array.from({ length: 9 }, (_, index) => 40 + index * 48);
export const BOARD_ROWS = Array.from({ length: 10 }, (_, index) => 38 + index * 48);
export const BOARD_BOUNDS = { left: 8, top: 8, right: 456, bottom: 500 };

// 이웃 교차점의 중간에서 영역을 나누고, 가장자리 칸은 판의 안쪽 테두리까지 받는다.
export function cellHitbox(column, row) {
  const left = column === 0 ? BOARD_BOUNDS.left : (BOARD_COLUMNS[column - 1] + BOARD_COLUMNS[column]) / 2;
  const right = column === BOARD_COLUMNS.length - 1 ? BOARD_BOUNDS.right : (BOARD_COLUMNS[column] + BOARD_COLUMNS[column + 1]) / 2;
  const top = row === 0 ? BOARD_BOUNDS.top : (BOARD_ROWS[row - 1] + BOARD_ROWS[row]) / 2;
  const bottom = row === BOARD_ROWS.length - 1 ? BOARD_BOUNDS.bottom : (BOARD_ROWS[row] + BOARD_ROWS[row + 1]) / 2;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
