import { between, shuffle, sleep } from './util.js';

const FINAL_STRETCH = 10;
const LAST_VOTER = 'Anurag Goel';

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

export async function runVoting(log, { awards, projects }, show, send) {
  const teams = projects.teams;
  const shuffled = shuffle(teams.flatMap((team) => team.members.map((voter) => ({ voter, team: team.name }))));
  const ballots = [
    ...shuffled.filter((b) => b.voter.name !== LAST_VOTER),
    ...shuffled.filter((b) => b.voter.name === LAST_VOTER),
  ];
  const appeal = awards.map(() => Object.fromEntries(teams.map((t) => [t.name, 0.1 + Math.random() ** 3])));
  const tallies = awards.map(() => ({}));
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
      const pick = weightedPick(eligible, (t) => appeal[award][t.name]).name;
      tallies[award][pick] = (tallies[award][pick] ?? 0) + 1;
      return pick;
    });
    send({ type: 'vote', n: i + 1, voter: { name: ballot.voter.name, org: ballot.voter.org }, picks });
  }

  return { total: ballots.length, awards: awardNames, tallies };
}
