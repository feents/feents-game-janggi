import { useLayoutEffect, useRef } from 'react';

export function useCaptureMotion(panelRef, pieces, captured, gameId) {
  const previous = useRef({ gameId, pieces: new Map(), captured: new Set() });
  const animations = useRef(new Set());
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const old = previous.current;
    const sameGame = old.gameId === gameId;
    if (!sameGame) { for (const animation of animations.current) animation.cancel(); animations.current.clear(); }
    const board = panel.querySelector('.janggi-board').getBoundingClientRect();
    const scale = board.width / 464;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sameGame && !reduced) {
      for (const element of panel.querySelectorAll('[data-captured-id]')) {
        const id = element.dataset.capturedId, piece = old.pieces.get(id);
        if (!piece || old.captured.has(id)) continue;
        const radius = ['soldier', 'guard'].includes(piece.type) ? 16 : 20;
        const from = { x: board.x + (40 + piece.column * 48 - radius) * scale,
          y: board.y + (38 + piece.row * 48 - radius) * scale, width: radius * 2 * scale, height: radius * 2 * scale };
        const to = element.getBoundingClientRect();
        const dx = from.x + from.width / 2 - to.x - to.width / 2;
        const dy = from.y + from.height / 2 - to.y - to.height / 2;
        element.style.zIndex = '5';
        const animation = element.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` },
          { transform: 'translate(0, 0) scale(1)' },
        ], { duration: 240, delay: 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
        animations.current.add(animation);
        animation.finished.catch(() => {}).finally(() => { animations.current.delete(animation); element.style.zIndex = ''; });
      }
    }
    previous.current = { gameId, captured: new Set(captured.map(piece => piece.id)), pieces: new Map(pieces.map(piece => [piece.id, piece])) };
  }, [panelRef, pieces, captured, gameId]);
  useLayoutEffect(() => () => { for (const animation of animations.current) animation.cancel(); }, []);
}
