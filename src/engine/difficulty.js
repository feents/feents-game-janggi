import { AI_LEVELS } from '../settings.js';

export function difficultyProfile(level) {
  const index = Math.max(0, AI_LEVELS.indexOf(level));
  return { skill: Math.round(-20 + index * 40 / 26), movetime: Math.round(180 * (3500 / 180) ** (index / 26)) };
}
