// 브라우저가 뒤늦게 만드는 click 대신 실제 탭 종료를 처리한다.
// 이동 거리는 화면 픽셀 기준이며 스크롤·드래그·다중 터치는 착수하지 않는다.
export function createBoardTap() {
  let tap = null;
  const pointers = new Set();
  const moved = event => Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10;
  return {
    down(event, square, enabled) {
      if (event.button !== 0) return;
      pointers.add(event.pointerId);
      tap = enabled && square && event.isPrimary && pointers.size === 1
        ? { id: event.pointerId, square, x: event.clientX, y: event.clientY, moved: false } : null;
    },
    move(event) {
      if (tap?.id === event.pointerId && moved(event)) tap.moved = true;
    },
    up(event) {
      pointers.delete(event.pointerId);
      if (tap?.id !== event.pointerId) return null;
      const square = event.button === 0 && !tap.moved && !moved(event) ? tap.square : null;
      tap = null;
      return square;
    },
    cancel(event) {
      pointers.delete(event.pointerId);
      if (tap?.id === event.pointerId) tap = null;
    },
    reset() { tap = null; pointers.clear(); },
    click(event, square) {
      // 포인터 입력 뒤의 호환 click은 중복 처리하지 않고 보조 기술의 click은 남긴다.
      const native = event.nativeEvent || event;
      return event.detail === 0 && !native.pointerType && !native.sourceCapabilities?.firesTouchEvents ? square : null;
    },
  };
}

// 선택을 화면 갱신 전에 저장해 다음 탭에서 바로 사용한다.
export function createBoardSelection() {
  let selected = null, fen = null, gameId = null;
  return {
    reset() { selected = null; },
    select(game, square) {
      if (game.fen !== fen || game.gameId !== gameId || game.phase !== 'humanTurn') selected = null;
      fen = game.fen; gameId = game.gameId;
      if (game.phase !== 'humanTurn') return { selected: null, message: '', move: null };
      if (selected && selected !== square && game.legalMoves.includes(`${selected}${square}`)) {
        const move = `${selected}${square}`;
        selected = null;
        return { selected, message: '', move };
      }
      const piece = game.pieces.find(item => item.square === square);
      if (piece?.side === game.settings.playerSide) {
        selected = selected === square ? null : square;
        return { selected, message: '', move: null };
      }
      selected = null;
      return { selected, message: '이동할 수 있는 점이 표시된 곳을 선택해 주세요.', move: null };
    },
  };
}
