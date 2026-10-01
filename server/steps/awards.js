import source from '../../builder_day_awards.json' with { type: 'json' };
import { AWARDS } from '../data/awards.js';
import { between, shuffle, sleep } from './util.js';

const FROM_FILE = 2;
const THEMED = 4;
const COUNT = FROM_FILE + THEMED;

const iconFor = (name) => `/award-icons/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;

const FILE_AWARDS = source.awards.map((a) => ({
  name: a.name,
  icon: iconFor(a.name),
  description: a.criteria_prompt.split(/(?<=\.)\s/)[0],
}));

export async function generateAwards(log, { theme }) {
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
  const [grand, ...classics] = shuffle(FILE_AWARDS).slice(0, FROM_FILE);
  const themed = shuffle(AWARDS[theme.name]).slice(0, THEMED);
  return [{ ...grand, grand: true }, ...classics, ...themed];
}
