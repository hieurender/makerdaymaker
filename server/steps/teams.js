import { headcountFor } from '../config.js';
import EMPLOYEES from '../data/employees.json' with { type: 'json' };
import { FIRST_NAMES, LAST_NAMES, TITLES } from '../data/names.js';
import { TEAM_NAMES } from '../data/themes.js';
import { between, hasTenure, shuffle, sleep } from './util.js';

const TEAM_SIZE = 5;
const MAX_TEAMS = 25;
const REQUIRED_TENURE_YEARS = 3;
const HEADCOUNT_PAUSE_MS = 5000;
const FRONTFILL_MS = 6000;
const FIRST_COHORT_YEAR = 2027;
const FIRST_COHORT_START = Date.UTC(2026, 9, 1);
const INITIALS = 'ABCDEFGHIJKLMNOPRSTVW';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (items, rng = Math.random) => items[Math.floor(rng() * items.length)];

function seededShuffle(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const shortOrg = (org) => org?.replace(/ Organization$/, '') ?? null;

function allocate(total, weights) {
  const sum = weights.reduce((a, w) => a + w.count, 0);
  const shares = weights.map((w) => ({ ...w, exact: (total * w.count) / sum }));
  shares.forEach((s) => (s.n = Math.floor(s.exact)));
  let left = total - shares.reduce((a, s) => a + s.n, 0);
  [...shares].sort((a, b) => (b.exact - b.n) - (a.exact - a.n)).slice(0, left).forEach((s) => s.n++);
  return shares;
}

function cohortStartDate(year, rng) {
  const start = year === FIRST_COHORT_YEAR ? FIRST_COHORT_START : Date.UTC(year - 1, 6, 1);
  const end = Date.UTC(year, 5, 30);
  return new Date(start + rng() * (end - start)).toISOString().slice(0, 10);
}

function fakeName(taken, rng) {
  for (let attempt = 0; ; attempt++) {
    const first = pick(FIRST_NAMES, rng);
    const last = pick(LAST_NAMES, rng);
    const name = attempt < 20 ? `${first} ${last}` : `${first} ${pick([...INITIALS], rng)}. ${last}`;
    if (taken.has(name)) continue;
    taken.add(name);
    return name;
  }
}

function hireCohort(year, size, orgCounts, taken) {
  const rng = seeded(year);
  const orgs = seededShuffle(
    allocate(size, orgCounts).flatMap(({ org, n }) => Array.from({ length: n }, () => org)),
    rng,
  );
  return orgs.map((org, i) => ({
    id: `F${year}-${String(i + 1).padStart(5, '0')}`,
    name: fakeName(taken, rng),
    title: pick(TITLES[org] ?? ['Generalist'], rng),
    org,
    startDate: cohortStartDate(year, rng),
    fake: true,
  }));
}

function tenureBracket(startDate) {
  if (!startDate) return 'unknown';
  const years = (Date.now() - Date.parse(startDate)) / (365 * 24 * 3600 * 1000);
  if (years < 1) return 'new';
  if (years < 2) return 'settled';
  if (years < 4) return 'seasoned';
  return 'veteran';
}

function teamName(names, i) {
  const lap = Math.floor(i / names.length);
  return lap === 0 ? names[i] : `${names[i % names.length]} ${lap + 1}`;
}

function selectParticipants(employees) {
  const veterans = employees.filter((e) => hasTenure(e, REQUIRED_TENURE_YEARS));
  const slots = Math.min(MAX_TEAMS, Math.round(employees.length / TEAM_SIZE)) * TEAM_SIZE;
  const others = shuffle(employees.filter((e) => !veterans.includes(e)));
  return [...veterans, ...others.slice(0, Math.max(0, slots - veterans.length))];
}

function assignTeams(employees, theme) {
  const count = Math.min(MAX_TEAMS, Math.max(1, Math.round(employees.length / TEAM_SIZE)));
  const names = shuffle(TEAM_NAMES[theme.name]);
  const teams = Array.from({ length: count }, (_, i) => ({ name: teamName(names, i), members: [] }));
  const orgSize = employees.reduce((acc, e) => ({ ...acc, [e.org]: (acc[e.org] ?? 0) + 1 }), {});
  const ordered = shuffle(employees).sort((a, b) => orgSize[b.org] - orgSize[a.org]);

  for (const employee of ordered) {
    const bracket = tenureBracket(employee.startDate);
    const cost = (team) => [
      team.members.length,
      team.members.filter((m) => m.org === employee.org).length,
      team.members.filter((m) => tenureBracket(m.startDate) === bracket).length,
    ];
    const best = shuffle(teams).reduce((a, b) => {
      const [ca, cb] = [cost(a), cost(b)];
      const i = ca.findIndex((v, k) => v !== cb[k]);
      return i === -1 || ca[i] <= cb[i] ? a : b;
    });
    best.members.push(employee);
  }
  return teams;
}

export async function formTeams(log, { theme }, show, _send, { year, headcount: target }) {
  const real = EMPLOYEES.map((e) => ({ ...e, org: shortOrg(e.org), fake: false }));
  const orgCounts = Object.entries(
    real.filter((e) => e.org).reduce((acc, e) => ({ ...acc, [e.org]: (acc[e.org] ?? 0) + 1 }), {}),
  ).map(([org, count]) => ({ org, count }));
  const taken = new Set(real.map((e) => e.name));
  const current = [...real];
  for (let y = FIRST_COHORT_YEAR; y < year; y++) {
    current.push(...hireCohort(y, Math.max(0, headcountFor(y) - current.length), orgCounts, taken));
  }
  const fakes = hireCohort(year, Math.max(0, target - current.length), orgCounts, taken);

  log(`Extrapolating number of employees by ${year}`);
  await sleep(between(900, 1300));
  log('Fitting growth curve to hiring history');
  await sleep(between(900, 1300));
  log(`Projected headcount: ${target}`);
  await sleep(between(600, 900));

  log('Frontfilling employees');
  await sleep(between(500, 800));
  const perHire = FRONTFILL_MS / Math.max(1, fakes.length);
  for (const employee of fakes) {
    log(`${employee.name} - ${employee.org}`);
    await sleep(perHire);
  }

  const employees = [...current, ...fakes];
  const countBy = (list, org) => list.filter((e) => e.org === org).length;
  const orgs = orgCounts
    .map(({ org }) => ({ org, current: countBy(current, org), added: countBy(fakes, org) }))
    .sort((a, b) => b.current + b.added - (a.current + a.added));
  show('headcount', { headcount: employees.length, orgs });
  await sleep(HEADCOUNT_PAUSE_MS);

  log('Collecting sign-ups');
  await sleep(between(900, 1300));
  const participants = selectParticipants(employees);
  log(`${participants.length} of ${employees.length} employees signed up`);
  await sleep(between(700, 1000));
  log('Assigning teams with a healthy mix of tenure & org distribution');
  await sleep(between(900, 1300));
  const teams = assignTeams(participants, theme);
  log(`Balancing tenure across ${teams.length} teams`);
  await sleep(between(800, 1200));
  log('Minimizing same-org clustering');
  await sleep(between(800, 1200));
  log(`Naming teams in the spirit of ${theme.name}`);
  await sleep(between(900, 1300));
  for (const team of teams) {
    const orgCount = new Set(team.members.map((m) => m.org).filter(Boolean)).size;
    log(`${team.name} - ${team.members.length} members across ${orgCount} orgs`);
    await sleep(between(50, 110));
  }
  return { headcount: employees.length, employees, teams };
}
