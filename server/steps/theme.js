import { THEMES } from '../data/themes.js';
import { between, sleep } from './util.js';

const LINES = [
  'Connecting to theme service',
  'Reading past Maker Day retros',
  'Brainstorming theme concepts',
  'Ranking candidates by vibes',
  'Checking for trademark conflicts',
];

let lastTheme;

export async function generateTheme(log) {
  const total = between(3000, 5000);
  for (const line of LINES) {
    log(line);
    await sleep(total / LINES.length);
  }
  const options = THEMES.filter((t) => t.name !== lastTheme);
  const theme = options[Math.floor(Math.random() * options.length)];
  lastTheme = theme.name;
  return theme;
}
