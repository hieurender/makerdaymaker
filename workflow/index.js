import { task } from '@renderinc/sdk/workflows';
import { buildPage, pitchTeam, reviewPage } from './stages.js';

const retry = { maxRetries: 2, waitDurationMs: 3000, backoffScaling: 2 };

export const pitch = task({ name: 'pitch', retry, timeoutSeconds: 120 }, async function pitch(_ctx, input) {
  return pitchTeam(input);
});

export const build = task({ name: 'build', retry, timeoutSeconds: 600 }, async function build(_ctx, input) {
  return buildPage(input);
});

export const review = task({ name: 'review', retry, timeoutSeconds: 600 }, async function review(_ctx, input) {
  return reviewPage(input);
});

export const buildTeam = task({ name: 'buildTeam', timeoutSeconds: 1800 }, async function buildTeam(ctx, { team, theme, awards }) {
  try {
    const teamPitch = await ctx.run(pitch, { team, theme, awards, stage: 'pitch' });
    const draft = await ctx.run(build, { team, theme, pitch: teamPitch, stage: 'build' });
    const reviewed = await ctx.run(review, { html: draft, team, stage: 'review' }).catch(() => ({ html: draft, status: 'error', problems: [] }));
    return { slug: team.slug, html: reviewed.html, pitch: teamPitch, review: reviewed.status, problems: reviewed.problems, error: null };
  } catch (error) {
    return { slug: team.slug, html: null, pitch: null, review: null, problems: [], error: String(error?.message ?? error) };
  }
});

export const buildProjects = task({ name: 'buildProjects', timeoutSeconds: 3600 }, async function buildProjects(ctx, { teams, theme, awards }) {
  const results = await Promise.all(teams.map((team) => ctx.run(buildTeam, { team, theme, awards, stage: 'buildTeam' })));
  return { results };
});
