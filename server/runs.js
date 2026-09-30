import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { generateTheme } from './steps/theme.js';

export const STEPS = [
  { key: 'theme', name: 'Generating a theme' },
  { key: 'awards', name: 'Generating awards' },
  { key: 'teams', name: 'Forming teams' },
  { key: 'projects', name: 'Building projects' },
  { key: 'voting', name: 'Voting' },
  { key: 'winners', name: 'Announcing winners' },
];

const runs = new Map();

export function getRun(id) {
  return runs.get(id);
}

export function createRun() {
  const run = { id: randomUUID(), events: [], emitter: new EventEmitter(), results: {} };
  runs.set(run.id, run);
  execute(run);
  return run;
}

function emit(run, event) {
  const withId = { id: run.events.length, at: Date.now(), ...event };
  run.events.push(withId);
  run.emitter.emit('event', withId);
}

async function execute(run) {
  const index = 0;
  const step = STEPS[index];
  emit(run, { type: 'step', index, total: STEPS.length, key: step.key, name: step.name });
  const log = (message) => emit(run, { type: 'log', message });
  const theme = await generateTheme(log);
  run.results.theme = theme;
  emit(run, { type: 'result', key: step.key, data: theme });
}
