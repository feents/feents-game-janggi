import { useLayoutEffect, useRef } from 'react';

// React가 SVG를 재배치하거나 여러 착수를 빠르게 반영해도 이동 시작점을 보존한다.
export function usePieceMotion(x, y, miniature) {
  const elementRef = useRef(null);
  const previous = useRef(null);
  const animationRef = useRef(null);

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = { x, y };
    if (!from || (from.x === x && from.y === y)) return;
    const element = elementRef.current;
    const running = animationRef.current;
    // 복기를 빠르게 넘기면 진행 중인 화면 위치에서 다음 목적지로 이어서 이동한다.
    const start = running ? getComputedStyle(element).transform : `translate(${from.x}px, ${from.y}px)`;
    running?.cancel();
    animationRef.current = null;
    if (miniature || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = element.animate([
      { transform: start },
      { transform: `translate(${x}px, ${y}px)` },
    ], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
    animationRef.current = animation;
    animation.finished.catch(() => {}).finally(() => {
      if (animationRef.current === animation) animationRef.current = null;
    });
  }, [x, y, miniature]);

  useLayoutEffect(() => () => animationRef.current?.cancel(), []);
  return elementRef;
}
