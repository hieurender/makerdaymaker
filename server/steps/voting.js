import { between, hasTenure, shuffle, sleep } from './util.js';

const FINAL_STRETCH = 10;
const LAST_VOTER_MIN_YEARS = 3;
const MOMENTUM = 0.05;
const WINNER_SHARE = [70 / 220, 100 / 220];

function voteDelay(progress, remaining) {
  if (remaining < FINAL_STRETCH) return between(300, 500);
  const skew = 0.5 + 1.5 * progress;
  return 100 * Math.random() ** (1 / skew);
}

function weightedPick(items, weight) {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

export async function runVoting(log, { awards, teams: roster, projects }, show, send) {
  const teams = projects.teams.filter((t) => !t.failed);
  const teamOf = new Map(projects.teams.flatMap((team) => team.members.map((m) => [m.id, team.name])));
  const shuffled = shuffle(roster.employees.map((voter) => ({ voter, team: teamOf.get(voter.id) })));
  const last = shuffled.find((b) => hasTenure(b.voter, LAST_VOTER_MIN_YEARS));
  const ballots = [...shuffled.filter((b) => b !== last), ...(last ? [last] : [])];
  const appeal = awards.map(() => Object.fromEntries(teams.map((t) => [t.name, 0.1 + Math.random() ** 3])));
  const tallies = awards.map(() => ({}));
  const targets = awards.map(() => ballots.length * between(...WINNER_SHARE));

  const vote = (award, eligible, remaining) => {
    const votes = tallies[award];
    const count = (t) => votes[t.name] ?? 0;
    const weight = (t) => appeal[award][t.name] + MOMENTUM * count(t);
    const leader = eligible.reduce((a, b) => (count(b) > count(a) ? b : a));
    if (count(leader) === 0) return weightedPick(eligible, weight);
    const leaderChance = Math.min(1, Math.max(0, (targets[award] - count(leader)) / remaining));
    if (Math.random() < leaderChance) return leader;
    return weightedPick(eligible.filter((t) => t !== leader), weight);
  };
  log(`Distributing ballots to ${ballots.length} employees`);
  await sleep(between(1000, 1500));
  log('Verifying voter eligibility');
  await sleep(between(800, 1200));
  log('Opening the polls');
  await sleep(between(800, 1200));

  const awardNames = awards.map((a) => a.name);
  show('voting', { total: ballots.length, awards: awardNames });
  await sleep(1000);

  for (const [i, ballot] of ballots.entries()) {
    await sleep(voteDelay(i / ballots.length, ballots.length - i));
    const eligible = teams.filter((t) => t.name !== ballot.team);
    const picks = awards.map((_, award) => {
      const pick = vote(award, eligible, ballots.length - i).name;
      tallies[award][pick] = (tallies[award][pick] ?? 0) + 1;
      return pick;
    });
    send({ type: 'vote', n: i + 1, voter: { name: ballot.voter.name, org: ballot.voter.org }, picks });
  }

  return { total: ballots.length, awards: awardNames, tallies };
}
