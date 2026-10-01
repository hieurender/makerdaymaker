import { access, writeFile } from 'node:fs/promises';
import source from '../builder_day_themes_top10.json' with { type: 'json' };

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('GEMINI_API_KEY is required');
  process.exit(1);
}

const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3-pro-image';
const ASPECT_RATIO = '21:9';
const OUT_DIR = 'client/public/banners';
const force = process.argv.includes('--force');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

export const bannerSlug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function generate(theme) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: theme.banner_prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ASPECT_RATIO } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(`no image returned (${body.candidates?.[0]?.finishReason ?? 'unknown'})`);
  return { data: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType };
}

const themes = source.themes.filter((t) => only.length === 0 || only.includes(bannerSlug(t.title)));
for (const theme of themes) {
  const path = `${OUT_DIR}/${bannerSlug(theme.title)}.png`;
  if (!force && (await exists(path))) {
    console.log(`skip ${path}`);
    continue;
  }
  const started = Date.now();
  try {
    const { data, mime } = await generate(theme);
    await writeFile(path, data);
    console.log(`wrote ${path} (${mime}, ${Math.round(data.length / 1024)} KB, ${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (err) {
    console.error(`fail ${theme.title}: ${err.message}`);
  }
}
