import { Render } from '@renderinc/sdk';
import { buildPage, pitchTeam, reviewPage } from '../workflow/stages.js';

const WORKFLOW_SLUG = process.env.WORKFLOW_SLUG;
const LOCAL_CONCURRENCY = 8;
const POLL_MS = 2000;
const STAGE_STATUS = { pitch: 'pitching', build: 'building', buildTeam: 'meeting & greeting', review: 'reviewing' };
const TERMINAL = new Set(['succeeded', 'completed', 'failed', 'canceled']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errorMessage = (error) => String(error?.message ?? error);

export const isLocal = () => process.env.LOCAL_WORKFLOW === '1' || !process.env.RENDER_API_KEY || !WORKFLOW_SLUG;

async function buildTeamLocally({ team, theme, awards }, onStatus) {
  try {
    onStatus(team.slug, STAGE_STATUS.pitch);
    const pitch = await pitchTeam({ team, theme, awards });
    onStatus(team.slug, STAGE_STATUS.build, pitch);
    const draft = await buildPage({ team, theme, pitch });
    onStatus(team.slug, STAGE_STATUS.review);
    const reviewed = await reviewPage({ html: draft }).catch(() => ({ html: draft, status: 'error', problems: [] }));
    return { slug: team.slug, html: reviewed.html, pitch, review: reviewed.status, problems: reviewed.problems, error: null };
  } catch (error) {
    console.error(`[workflow] ${team.slug}: stage failed - ${errorMessage(error)}`);
    return { slug: team.slug, html: null, pitch: null, error: errorMessage(error) };
  }
}

async function runLocally({ theme, awards, teams, onStatus }) {
  const results = [];
  const queue = [...teams];
  const worker = async () => {
    for (let team = queue.shift(); team; team = queue.shift()) {
      results.push(await buildTeamLocally({ team, theme, awards }, onStatus));
    }
  };
  await Promise.all(Array.from({ length: LOCAL_CONCURRENCY }, worker));
  return results;
}

// The API lists runs without their inputs, so each run is fetched once to learn
// which team it belongs to and which stage its task name says it is in.
async function trackStages(workflows, rootId, onStatus, seen) {
  const runs = await workflows.listTaskRuns({ rootTaskRunId: rootId, limit: 100 });
  const fresh = runs.map((r) => r.taskRun).filter((run) => run.id !== rootId && !seen.has(run.id));
  await Promise.all(
    fresh.map(async (run) => {
      seen.add(run.id);
      const details = await workflows.getTaskRun(run.id);
      const input = Array.isArray(details.input) ? details.input[0] : details.input;
      const slug = input?.team?.slug;
      const stage = input?.stage;
      if (slug && STAGE_STATUS[stage]) onStatus(slug, STAGE_STATUS[stage]);
    }),
  );
}

async function runOnRender({ theme, awards, teams, onStatus, log }) {
  const { workflows } = new Render();
  const run = await workflows.startTask(`${WORKFLOW_SLUG}/buildProjects`, [{ theme, awards, teams }]);
  log(`Workflow run started: ${run.taskRunId}`);
  const seen = new Set();
  for (;;) {
    await sleep(POLL_MS);
    const details = await workflows.getTaskRun(run.taskRunId).catch((error) => {
      log(`Temporary error polling ${run.taskRunId}: ${errorMessage(error)}`);
    });
    if (!details) continue;
    if (!TERMINAL.has(details.status)) {
      await trackStages(workflows, run.taskRunId, onStatus, seen).catch(() => {});
      continue;
    }
    if (details.status !== 'succeeded' && details.status !== 'completed') {
      throw new Error(`Workflow run ${run.taskRunId} ${details.status}: ${details.error ?? 'no error given'}`);
    }
    const results = details.results?.[0]?.results;
    if (!Array.isArray(results)) throw new Error('Workflow returned an unexpected result shape');
    return results;
  }
}

export function runProjects(args) {
  if (isLocal()) {
    args.log('Running tasks in-process (set RENDER_API_KEY and WORKFLOW_SLUG to use Render Workflows)');
    return runLocally(args);
  }
  return runOnRender(args);
}
