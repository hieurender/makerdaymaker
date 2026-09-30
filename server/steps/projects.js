import { between, shuffle, sleep } from './util.js';

const MINGLING = [
  'bickering',
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

async function buildOne(team, theme, year, setStatus) {
  setStatus('meeting & greeting');
  await sleep(2000);

  let last;
  const changes = Math.floor(between(3, 9));
  for (let i = 0; i < changes; i++) {
    const options = MINGLING.filter((s) => s !== last);
    last = options[Math.floor(Math.random() * options.length)];
    setStatus(last);
    await sleep(between(2000, 2600));
  }

  setStatus('building');
  await sleep(between(2000, 4000));
  pages.set(team.slug, renderPage(team, theme, year));

  if (Math.random() < 0.2) {
    setStatus('last-minute changes');
    await sleep(between(2000, 3000));
  }

  setStatus('ready');
}

export async function buildProjects(_log, { theme, teams: roster }, show, send, { year }) {
  const teams = roster.teams.map((t) => ({ ...t, slug: slugify(t.name) }));
  show('projects', { teams });
  await Promise.all(
    teams.map((team) => buildOne(team, theme, year, (status) => send({ type: 'team-status', slug: team.slug, status }))),
  );
  return { teams };
}
