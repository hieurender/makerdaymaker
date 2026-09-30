import { between, shuffle, sleep } from './util.js';

export async function announceWinners(log, { awards, projects, voting }) {
  log(`Counting ${voting.total} ballots`);
  await sleep(between(1200, 1600));
  log('Double-checking the math');
  await sleep(between(900, 1300));
  log('Sealing envelopes');
  await sleep(between(900, 1300));

  const teams = new Map(projects.teams.map((t) => [t.name, t]));
  const reveals = awards.map((award, i) => {
    const ranked = shuffle(Object.entries(voting.tallies[i])).sort((a, b) => b[1] - a[1]);
    const [winnerName, votes] = ranked[0];
    const team = teams.get(winnerName);
    return {
      award,
      winner: {
        team: team.name,
        slug: team.slug,
        votes,
        members: team.members.map((m) => ({ id: m.id, name: m.name, org: m.org, fake: m.fake })),
      },
      runnersUp: ranked.slice(1, 3).reduce((places, [name, count]) => {
        const above = places.at(-1)?.votes ?? votes;
        return [...places, { team: name, votes: Math.min(count, above - 1) }];
      }, []),
    };
  });

  return { reveals: [...reveals.filter((r) => !r.award.grand), ...reveals.filter((r) => r.award.grand)] };
}
