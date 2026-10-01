import source from '../../builder_day_themes_top10.json' with { type: 'json' };

const slug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const THEMES = source.themes.map((t) => ({ name: t.title, tagline: t.slogan, banner: `/banners/${slug(t.title)}.png` }));

export const TEAM_NAMES = Object.fromEntries(source.themes.map((t) => [t.title, t.team_names]));
