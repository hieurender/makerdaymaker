import { writeFile } from 'node:fs/promises';

const token = process.env.SLACK_TOKEN;
if (!token) {
  console.error('SLACK_TOKEN is required (scopes: users:read, users.profile:read)');
  process.exit(1);
}

const out = process.argv[2] ?? 'server/data/employees.json';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function slack(method, params = {}) {
  for (;;) {
    const res = await fetch(`https://slack.com/api/${method}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 429) {
      await sleep(Number(res.headers.get('retry-after') ?? 5) * 1000);
      continue;
    }
    const body = await res.json();
    if (!body.ok) throw new Error(`${method}: ${body.error}`);
    return body;
  }
}

const { profile } = await slack('team.profile.get');
const labels = Object.fromEntries(profile.fields.map((f) => [f.id, f.label]));
console.log('Custom profile fields:', Object.values(labels).join(', ') || '(none)');

const findField = (pattern) => profile.fields.find((f) => pattern.test(f.label))?.id;
const orgField = findField(/department|org|team/i);
const startField = findField(/start/i);
console.log(`Using org field: ${labels[orgField] ?? '(none)'}, start field: ${labels[startField] ?? '(none)'}`);

const members = [];
let cursor;
do {
  const page = await slack('users.list', { limit: 200, ...(cursor && { cursor }) });
  members.push(...page.members);
  cursor = page.response_metadata?.next_cursor;
} while (cursor);

const people = members.filter(
  (m) => !m.deleted && !m.is_bot && !m.is_app_user && !m.is_restricted && m.id !== 'USLACKBOT',
);
console.log(`Fetching profiles for ${people.length} people`);

const employees = [];
for (const [i, m] of people.entries()) {
  const { profile: p } = await slack('users.profile.get', { user: m.id });
  const fields = p.fields ?? {};
  employees.push({
    id: m.id,
    name: p.real_name || m.name,
    title: p.title || null,
    org: fields[orgField]?.value || null,
    startDate: fields[startField]?.value || null,
  });
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${people.length}`);
}

await writeFile(out, JSON.stringify(employees, null, 2) + '\n');
const withOrg = employees.filter((e) => e.org).length;
const withStart = employees.filter((e) => e.startDate).length;
console.log(`Wrote ${employees.length} employees to ${out} (org: ${withOrg}, start date: ${withStart})`);
