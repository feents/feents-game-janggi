import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// 폰트 교체로 첫 화면이 깜빡이지 않도록 폰트 준비 후 한 번만 마운트한다.
async function bootstrap() {
  const fonts = await Promise.allSettled([
    document.fonts.load('400 16px "Pretendard Variable"', '장기 FEENTS'),
    document.fonts.load('800 16px "Pretendard Variable"', '장기 FEENTS 楚漢'),
    document.fonts.load('400 16px "JetBrains Mono"', '0123456789'),
  ]);

  // 실패한 폰트는 이후에도 교체되지 않도록 해당 세션에서 폴백을 고정한다.
  if (fonts.slice(0, 2).some((font) => font.status === 'rejected')) {
    document.documentElement.dataset.sansFallback = 'true';
  }
  if (fonts[2].status === 'rejected') {
    document.documentElement.dataset.monoFallback = 'true';
  }
  await document.fonts.ready;
  const root = document.getElementById('root');
  root.removeAttribute('aria-busy');
  createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
}

bootstrap();
