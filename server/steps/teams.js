import EMPLOYEES from '../data/employees.json' with { type: 'json' };
import { FIRST_NAMES, LAST_NAMES, TITLES } from '../data/names.js';
import { TEAM_NAMES } from '../data/themes.js';
import { between, hasTenure, shuffle, sleep } from './util.js';

const TEAM_SIZE = 5;
const MAX_TEAMS = 25;
const REQUIRED_TENURE_YEARS = 3;
const HEADCOUNT_PAUSE_MS = 5000;

const pick = (items) => items[Math.floor(Math.random() * items.length)];
const shortOrg = (org) => org?.replace(/ Organization$/, '') ?? null;

function allocate(total, weights) {
  const sum = weights.reduce((a, w) => a + w.count, 0);
  const shares = weights.map((w) => ({ ...w, exact: (total * w.count) / sum }));
  shares.forEach((s) => (s.n = Math.floor(s.exact)));
  let left = total - shares.reduce((a, s) => a + s.n, 0);
  [...shares].sort((a, b) => (b.exact - b.n) - (a.exact - a.n)).slice(0, left).forEach((s) => s.n++);
  return shares;
}

function futureStartDate(year) {
  const now = Date.now();
  const end = Date.UTC(year, 5, 30);
  return new Date(between(now, end)).toISOString().slice(0, 10);
}

function fakeNames(count, taken) {
  const names = [];
  while (names.length < count) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    if (taken.has(name)) continue;
    taken.add(name);
    names.push(name);
  }
  return names;
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
  const current = EMPLOYEES.map((e) => ({ ...e, org: shortOrg(e.org), fake: false }));

  log(`Extrapolating number of employees by ${year}`);
  await sleep(between(900, 1300));
  log('Fitting growth curve to hiring history');
  await sleep(between(900, 1300));
  log(`Projected headcount: ${target}`);
  await sleep(between(600, 900));

  const orgCounts = Object.entries(
    current.filter((e) => e.org).reduce((acc, e) => ({ ...acc, [e.org]: (acc[e.org] ?? 0) + 1 }), {}),
  ).map(([org, count]) => ({ org, count }));
  const allocation = allocate(Math.max(0, target - current.length), orgCounts);

  const taken = new Set(current.map((e) => e.name));
  const hires = shuffle(allocation.flatMap(({ org, n }) => Array.from({ length: n }, () => org)));
  const names = fakeNames(hires.length, taken);

  log('Frontfilling employees');
  await sleep(between(500, 800));
  const fakes = [];
  for (const [i, org] of hires.entries()) {
    const employee = { id: `F${String(i + 1).padStart(4, '0')}`, name: names[i], title: pick(TITLES[org] ?? ['Generalist']), org, startDate: futureStartDate(year), fake: true };
    fakes.push(employee);
    log(`${employee.name} - ${org}`);
    await sleep(between(60, 140));
  }

  const employees = [...current, ...fakes];
  const orgs = orgCounts
    .map(({ org, count }) => ({ org, current: count, added: allocation.find((a) => a.org === org).n }))
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
