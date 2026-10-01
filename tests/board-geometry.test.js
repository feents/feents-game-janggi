import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_BOUNDS, BOARD_COLUMNS, BOARD_ROWS, cellHitbox } from '../src/board-geometry.js';
import { screenToSquare, squareToScreen } from '../src/game/position-codec.js';

const cells = BOARD_ROWS.flatMap((y, row) => BOARD_COLUMNS.map((x, column) => ({ column, row, x, y, bounds: cellHitbox(column, row) })));

test('90개 터치 영역이 장기판 안쪽을 빈틈과 겹침 없이 채운다', () => {
  const width = BOARD_BOUNDS.right - BOARD_BOUNDS.left;
  const height = BOARD_BOUNDS.bottom - BOARD_BOUNDS.top;
  const coverage = new Uint8Array(width * height);
  for (const { x, y, bounds } of cells) {
    assert.ok(bounds.x <= x && x < bounds.x + bounds.width);
    assert.ok(bounds.y <= y && y < bounds.y + bounds.height);
    assert.ok(bounds.x >= BOARD_BOUNDS.left && bounds.x + bounds.width <= BOARD_BOUNDS.right);
    assert.ok(bounds.y >= BOARD_BOUNDS.top && bounds.y + bounds.height <= BOARD_BOUNDS.bottom);
    for (let py = bounds.y; py < bounds.y + bounds.height; py++) {
      for (let px = bounds.x; px < bounds.x + bounds.width; px++) {
        coverage[(py - BOARD_BOUNDS.top) * width + px - BOARD_BOUNDS.left]++;
      }
    }
  }
  assert.equal(coverage.every(count => count === 1), true);
});

test('칸의 네 모서리 부근까지 가장 가까운 교차점에 속한다', () => {
  for (const cell of cells) {
    const { bounds } = cell;
    for (const x of [bounds.x + 0.1, bounds.x + bounds.width - 0.1]) {
      for (const y of [bounds.y + 0.1, bounds.y + bounds.height - 0.1]) {
        const nearest = cells.reduce((best, candidate) => {
          const distance = (candidate.x - x) ** 2 + (candidate.y - y) ** 2;
          return !best || distance < best.distance ? { cell: candidate, distance } : best;
        }, null);
        assert.equal(nearest.cell, cell);
      }
    }
  }
});

test('초·한 어느 방향에서도 모든 터치 영역은 서로 다른 엔진 칸에 대응한다', () => {
  for (const side of ['cho', 'han']) {
    const squares = cells.map(({ column, row }) => screenToSquare(column, row, side));
    assert.equal(new Set(squares).size, 90);
    cells.forEach(({ column, row }, index) => assert.deepEqual(squareToScreen(squares[index], side), { column, row }));
  }
});
