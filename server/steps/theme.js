import { THEMES } from '../data/themes.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const LINES = [
  'Connecting to theme service',
  `Sampling ${THEMES.length} candidate themes`,
  'Ranking candidates by vibes',
  'Checking for trademark conflicts',
];

export async function generateTheme(log) {
  const total = 3000 + Math.random() * 2000;
  for (const line of LINES) {
    log(line);
    await sleep(total / LINES.length);
  }
  return THEMES[Math.floor(Math.random() * THEMES.length)];
}
