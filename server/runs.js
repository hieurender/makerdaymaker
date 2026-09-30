import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { nextConfig } from './config.js';
import { generateAwards } from './steps/awards.js';
import { buildProjects } from './steps/projects.js';
import { formTeams } from './steps/teams.js';
import { generateTheme } from './steps/theme.js';
import { runVoting } from './steps/voting.js';
import { announceWinners } from './steps/winners.js';

export const STEPS = [
  { key: 'theme', name: 'Generating a theme', run: generateTheme },
  { key: 'awards', name: 'Generating awards', run: generateAwards },
  { key: 'teams', name: 'Forming teams', run: formTeams },
  { key: 'projects', name: 'Building projects', run: buildProjects },
  { key: 'voting', name: 'Voting', run: runVoting },
  { key: 'winners', name: 'Announcing winners', run: announceWinners },
];

const runs = new Map();

export function getRun(id) {
  return runs.get(id);
}

export function createRun(config) {
  const run = { id: randomUUID(), config, index: 0, busy: false, events: [], emitter: new EventEmitter(), results: {} };
  runs.set(run.id, run);
  execute(run);
  return run;
}

export function retry(run) {
  if (run.busy) return false;
  execute(run);
  return true;
}

export function approve(run) {
  if (run.busy || !(STEPS[run.index].key in run.results)) return false;
  if (run.index === STEPS.length - 1) {
    if (run.finished) return false;
    run.finished = true;
    emit(run, { type: 'finished', next: nextConfig(run.config) });
    return true;
  }
  run.index += 1;
  execute(run);
  return true;
}

function emit(run, event) {
  const withId = { id: run.events.length, at: Date.now(), ...event };
  run.events.push(withId);
  run.emitter.emit('event', withId);
}

async function execute(run) {
  const index = run.index;
  const step = STEPS[index];
  run.busy = true;
  delete run.results[step.key];
  emit(run, { type: 'step', index, total: STEPS.length, key: step.key, name: step.name });
  const log = (message) => emit(run, { type: 'log', message });
  if (!step.run) {
    log('Not built yet');
    run.busy = false;
    return;
  }
  const show = (view, data) => emit(run, { type: 'interim', view, data });
  const send = (event) => emit(run, event);
  const data = await step.run(log, run.results, show, send, run.config);
  run.results[step.key] = data;
  run.busy = false;
  emit(run, { type: 'result', key: step.key, data });
}
