import { AWARDS } from '../data/awards.js';
import { between, shuffle, sleep } from './util.js';

const COUNT = 6;

export async function generateAwards(log, { theme }) {
  const pool = AWARDS[theme.name];
  log(`Loading theme context: ${theme.name}`);
  await sleep(between(700, 1100));
  log('Brainstorming award concepts');
  await sleep(between(900, 1400));
  log(`Cutting to the best ${COUNT}`);
  await sleep(between(700, 1100));
  for (let i = 1; i <= COUNT; i++) {
    log(`Engraving trophy ${i}/${COUNT}`);
    await sleep(between(150, 300));
  }
  const [grand, ...rest] = pool;
  return [grand, ...shuffle(rest).slice(0, COUNT - 1)];
}
