// 대한장기협회 점수 기준. 궁은 기물 점수에서 제외한다.
// https://koreajanggi.cafe24.com/participation/notice_board.php?id=217&offset=0&show=view
const PIECE_POINTS = {
  general: 0,
  chariot: 13,
  cannon: 7,
  horse: 5,
  elephant: 3,
  guard: 3,
  soldier: 2,
};

const HAN_BONUS = 1.5;

export function calculateMaterialScores(pieces) {
  const material = { cho: 0, han: 0 };
  for (const piece of pieces) material[piece.side] += PIECE_POINTS[piece.type];

  return {
    cho: { material: material.cho, bonus: 0, total: material.cho },
    han: { material: material.han, bonus: HAN_BONUS, total: material.han + HAN_BONUS },
  };
}
