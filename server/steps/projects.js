import { between, shuffle, sleep } from './util.js';
import { runProjects } from '../workflowClient.js';
import { DEMOS, DOMAINS, LOOKS } from '../../workflow/styles.js';

const FAILURE_CHANCE = 0.05;
const MIN_BUILD_MS = 10000;
const READY_SPREAD_MS = 4000;
const LAST_MINUTE_CHANCE = 0.2;
const EARLY_STAGES = new Set(['queued', 'meeting & greeting', 'pitching']);

const MINGLING = [
  'bickering',
  'arguing',
  'gelling',
  'lunching',
  'procrastinating',
  'bikeshedding',
  'whiteboarding',
  'naming things',
  'arguing about tabs vs spaces',
  'rubber-ducking',
  'scoping down',
  'scoping back up',
  'reading the docs',
  'rewriting it in Rust',
  'snacking',
  'pair programming',
  'googling the error',
];
const FAILED = 'failed spectacularly';

const FEATURES = [
  ['One-click everything', 'Press the button. Things happen. You go home early.'],
  ['Zero config', 'Sensible defaults, so you never open a YAML file again.'],
  ['Works on Fridays', 'Ship at 4:59 PM and keep your weekend.'],
  ['Dark mode, obviously', 'Your retinas called. They said thanks.'],
  ['Autoscaling vibes', 'From one user to all of them without a meeting.'],
  ['Built-in undo', 'Every mistake is a draft.'],
  ['Private by default', 'Nobody sees it unless you say so.'],
  ['Instant previews', 'Every branch gets a URL before you finish the PR description.'],
  ['Observable', 'Metrics, logs, and a graph that only goes up.'],
  ['Fast', 'We measured it once and it was very fast.'],
  ['Slack integration', 'Get notified about the things that matter, and nothing else.'],
  ['AI inside', 'It has a model. The model has opinions.'],
  ['Offline mode', 'Works on the train, in the tunnel, and in the basement.'],
  ['Keyboard first', 'Every action has a shortcut. Some have two.'],
  ['Audit trail', 'Know who did what, when, and roughly why.'],
  ['Friendly errors', 'When it breaks, it tells you how to fix it.'],
];

const PALETTES = [
  { bg: '#0b1020', fg: '#f4f6ff', accent: '#7c9cff' },
  { bg: '#fff8ef', fg: '#1d1206', accent: '#e2621b' },
  { bg: '#0f1a14', fg: '#eafff2', accent: '#3ddc84' },
  { bg: '#f5f3ff', fg: '#1b1036', accent: '#7c3aed' },
  { bg: '#101010', fg: '#fafafa', accent: '#ffcc00' },
  { bg: '#eef9ff', fg: '#06263a', accent: '#0088e5' },
  { bg: '#1a0b12', fg: '#ffeef5', accent: '#ff4f8b' },
];

const pages = new Map();

export function getPage(slug) {
  return pages.get(slug);
}

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function renderPage(team, theme, year) {
  const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const features = shuffle(FEATURES).slice(0, 3);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(team.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: ${p.bg}; color: ${p.fg}; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
  main { max-width: 1040px; margin: 0 auto; padding: 48px 24px 96px; display: flex; flex-direction: column; gap: 96px; }
  nav { display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
  nav span { opacity: 0.6; font-weight: 400; font-size: 14px; }
  .hero { display: flex; flex-direction: column; gap: 24px; }
  h1 { font-size: clamp(48px, 9vw, 104px); line-height: 1; letter-spacing: -0.03em; margin: 0; }
  .lede { font-size: 22px; line-height: 1.4; opacity: 0.8; max-width: 36ch; margin: 0; }
  .cta { align-self: flex-start; background: ${p.accent}; color: ${p.bg}; padding: 16px 28px; font-size: 18px; font-weight: 600; text-decoration: none; border-radius: 999px; }
  .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }
  .feature { border-top: 2px solid ${p.accent}; padding-top: 16px; }
  .feature h2 { font-size: 20px; margin: 0 0 8px; }
  .feature p { margin: 0; opacity: 0.75; line-height: 1.5; }
  footer { font-size: 14px; opacity: 0.6; line-height: 1.6; }
</style>
</head>
<body>
<main>
  <nav>${escape(team.name)} <span>Maker Day ${year}</span></nav>
  <section class="hero">
    <h1>${escape(team.name)}</h1>
    <p class="lede">${escape(theme.tagline)}</p>
    <a class="cta" href="#">Get early access</a>
  </section>
  <section class="features">
    ${features.map(([title, body]) => `<div class="feature"><h2>${escape(title)}</h2><p>${escape(body)}</p></div>`).join('\n    ')}
  </section>
  <footer>Built for the ${escape(theme.name)} theme by ${team.members.map((m) => escape(m.name)).join(', ')}.</footer>
</main>
</body>
</html>`;
}

const HEARTBEAT_MS = 15000;
const publicPitch = ({ product, tagline }) => ({ product, tagline });
const MAX_TEAMS = Number(process.env.MAX_TEAMS) || Infinity;

export async function buildProjects(log, { theme, awards, teams: roster }, show, send, { year }) {
  const teams = roster.teams.slice(0, MAX_TEAMS).map((t) => ({ ...t, slug: slugify(t.name) }));
  const started = Date.now();
  const elapsed = () => `+${Math.round((Date.now() - started) / 1000)}s`;
  const real = new Map();
  const current = new Map();
  const display = (slug, value) => {
    current.set(slug, value);
    const pitch = real.get(slug)?.pitch;
    send({ type: 'team-status', slug, status: value, pitch: pitch ? publicPitch(pitch) : undefined });
  };
  const onStatus = (slug, value, pitch) => {
    const known = real.get(slug)?.pitch;
    real.set(slug, { stage: value, pitch: pitch ?? known });
    console.log(`[workflow] ${elapsed()} ${slug}: ${value}${pitch ? ` - "${pitch.product}"` : ''}`);
  };
  const heartbeat = setInterval(() => {
    const counts = {};
    for (const value of real.values()) counts[value.stage] = (counts[value.stage] ?? 0) + 1;
    console.log(`[workflow] ${elapsed()} progress: ${JSON.stringify(counts)}`);
  }, HEARTBEAT_MS);
  const looks = shuffle(LOOKS);
  const demos = shuffle(DEMOS);
  const domains = shuffle(DOMAINS);
  const brief = teams.map((t, i) => ({
    name: t.name,
    slug: t.slug,
    style: { look: looks[i % looks.length], demo: demos[i % demos.length], domain: domains[i % domains.length] },
  }));

  let finished = false;
  const early = (slug) => EARLY_STAGES.has(real.get(slug)?.stage ?? 'queued');
  const perform = async (team) => {
    display(team.slug, 'meeting & greeting');
    await sleep(2000);
    let last;
    const changes = Math.floor(between(3, 9));
    for (let i = 0; i < changes || (!finished && early(team.slug)); i++) {
      const options = MINGLING.filter((s) => s !== last);
      last = options[Math.floor(Math.random() * options.length)];
      display(team.slug, last);
      await sleep(between(2000, 2600));
    }
    let stage;
    while (!finished) {
      const now = real.get(team.slug)?.stage;
      if (now && now !== stage && !EARLY_STAGES.has(now)) {
        stage = now;
        display(team.slug, now);
      }
      await sleep(250);
    }
    if (!stage) {
      display(team.slug, 'building');
      await sleep(between(2000, 4000));
    }
  };

  show('projects', { teams });
  teams.forEach((t) => onStatus(t.slug, 'queued'));
  console.log(`[workflow] starting ${teams.length} teams`);
  const performances = teams.map(perform);
  const results = await runProjects({ theme, awards, teams: brief, onStatus, log }).finally(() => {
    clearInterval(heartbeat);
    finished = true;
  });

  const bySlug = new Map(results.map((r) => [r.slug, r]));
  const failed = new Set();
  const settle = () => sleep(Math.max(0, started + MIN_BUILD_MS + between(0, READY_SPREAD_MS) - Date.now()));
  await Promise.all(teams.map(async (team, i) => {
    await performances[i];
    const result = bySlug.get(team.slug);
    if (Math.random() < FAILURE_CHANCE) {
      failed.add(team.slug);
      await settle();
      display(team.slug, FAILED);
      return;
    }
    if (result?.html) {
      pages.set(team.slug, result.html);
      console.log(`[workflow] ${team.slug}: review ${result.review}${result.problems?.length ? ` - ${result.problems.join('; ')}` : ''}`);
    } else {
      console.error(`[workflow] ${team.slug}: FAILED - ${result?.error ?? 'no result'}`);
      log(`${team.name}: build failed (${result?.error ?? 'no result'}); shipping a template page`);
      pages.set(team.slug, renderPage(team, theme, year));
    }
    if (Math.random() < LAST_MINUTE_CHANCE) {
      display(team.slug, 'last-minute changes');
      await sleep(between(2000, 3000));
    }
    await settle();
    display(team.slug, 'ready');
  }));
  console.log(`[workflow] finished: ${teams.length} teams, ${results.filter((r) => r.html).length} built by AI`);
  return { teams: teams.map((team) => ({ ...team, failed: failed.has(team.slug) })) };
}
