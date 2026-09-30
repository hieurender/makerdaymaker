import vm from 'node:vm';
import { ask as askOnce, MODELS } from './llm.js';

const ATTEMPTS = 3;
const BUILD_EFFORT = process.env.BUILD_EFFORT || 'low';

async function ask(options) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await askOnce(options);
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
    }
  }
}

const awardLine = (a) => `- ${a.name}: ${a.description}`;

function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('pitch: no JSON object in response');
  return JSON.parse(text.slice(start, end + 1));
}

function extractHtml(text) {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/<!doctype html|<html/i);
  if (start === -1) throw new Error(`response contained no HTML document (${text.length} chars, starts: ${JSON.stringify(text.slice(0, 120))})`);
  return body.slice(start);
}

const isColor = (c) => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c);

function validatePitch(p) {
  const features = Array.isArray(p.features) ? p.features.filter((f) => f?.title && f?.body).slice(0, 4) : [];
  const palette = p.palette ?? {};
  if (!p.product || !p.tagline || features.length < 2) throw new Error('pitch: missing product, tagline or features');
  if (![palette.bg, palette.fg, palette.accent].every(isColor)) throw new Error('pitch: invalid palette');
  return { product: String(p.product), tagline: String(p.tagline), palette, features };
}

export async function pitchTeam({ team, theme, awards }) {
  const text = await ask({
    model: MODELS.pitch,
    maxTokens: 1200,
    system:
      'You invent a fun, slightly silly internal product for a company hackathon called Maker Day. ' +
      'Reply with a single JSON object and nothing else.',
    prompt:
      `Theme: "${theme.name}" - ${theme.tagline}\n` +
      `Team name: "${team.name}"\n` +
      `Suggested domain (a hint only): ${team.style.domain}\n` +
      `Assigned demo format: ${team.style.demo}\n` +
      `Assigned visual style: ${team.style.look.name}\n\n` +
      `The team is competing for these awards:\n${awards.map(awardLine).join('\n')}\n\n` +
      'Pitch the app this team builds. It should be the kind of project that could impress the judges and win awards like these, but it does not need to target any single award. JSON shape:\n' +
      '{"product": "catchy product name", "tagline": "one witty sentence", ' +
      '"palette": {"bg": "#hex", "fg": "#hex", "accent": "#hex"}, ' +
      '"features": [{"title": "...", "body": "one sentence"}, ...3 items]}\n' +
      'The team name is the main inspiration: the product must be a pun, a literal reading or a clever riff on the name, so that anyone seeing the name next to the product gets the joke. ' +
      'Use the suggested domain only as flavor when it fits the name; if it conflicts with the name, the name wins. Also see the theme, and avoid generic ideas other teams would pick. It must fit the assigned demo format and visual style, and the palette must suit the visual style. Make bg/fg high contrast.',
  });
  return validatePitch(parseJson(text));
}

export async function buildPage({ team, theme, pitch }) {
  const text = await ask({
    model: MODELS.build,
    maxTokens: 16000,
    effort: BUILD_EFFORT,
    system:
      'You are a senior front-end engineer and designer. You output exactly one complete, self-contained ' +
      'HTML document and nothing else - no explanation, no markdown.',
    prompt:
      `Build the web app for this Maker Day team.\n\n` +
      `Theme: "${theme.name}" - ${theme.tagline}\n` +
      `Team name: "${team.name}" - the product is a riff on this name, so show the name prominently and make the copy and UI play on it.\n` +
      `Assigned visual style: ${team.style.look.name} - ${team.style.look.brief}\n` +
      `Assigned demo format: ${team.style.demo}\n` +
      `Product: ${pitch.product} - ${pitch.tagline}\n` +
      `Features: ${pitch.features.map((f) => `${f.title}: ${f.body}`).join(' | ')}\n` +
      `Palette: background ${pitch.palette.bg}, text ${pitch.palette.fg}, accent ${pitch.palette.accent}\n\n` +
      'Requirements:\n' +
      '- One file: inline <style> and <script>. No external scripts, fonts, images, iframes or network requests.\n' +
      '- It must be a working interactive demo of the product in the assigned demo format, not just a landing page. Include the demo, a title, and a footer crediting the team.\n' +
      '- Commit fully to the assigned visual style in layout, typography, shapes and interactions. Do NOT produce the generic centered hero with three feature cards; let the style dictate the structure.\n' +
      '- Humor is welcome. Responsive, accessible, polished typography and spacing.\n' +
      '- Vanilla JS only; no errors in the console.\n' +
      '- Be economical with tokens: aim for about 5,000 output tokens (roughly 15 KB) and never exceed 12,000, so the document is always complete and closed. ' +
      'No code comments, no placeholder or filler text, compact CSS (shared rules, CSS variables), small focused JS, one great demo rather than many features. ' +
      'Output the document directly with no preamble.',
  });
  return extractHtml(text);
}

const scriptBlocks = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

export function checkHtml(html) {
  const problems = [];
  if (!/<\/html>\s*$/i.test(html.trim())) problems.push('document is truncated: it does not end with </html>');
  scriptBlocks(html).forEach((code, i) => {
    try {
      new vm.Script(code);
    } catch (error) {
      problems.push(`script ${i + 1} has a syntax error: ${error.message}`);
    }
  });
  if (/(?:src|href)=["']https?:\/\//i.test(html) || /\bfetch\(|XMLHttpRequest|\bimport\(/.test(html)) {
    problems.push('page references external resources or makes network requests');
  }
  return problems;
}

function closeTruncated(html) {
  const unclosedScript = (html.match(/<script/gi) ?? []).length > (html.match(/<\/script>/gi) ?? []).length;
  return `${html}${unclosedScript ? '\n</script>' : ''}\n</body>\n</html>`;
}

function applyPatches(html, patches) {
  return patches.reduce((page, { find, replace }) => {
    const unique = typeof find === 'string' && find && page.split(find).length === 2;
    return unique ? page.replace(find, () => String(replace ?? '')) : page;
  }, html);
}

export async function reviewPage({ html }) {
  const problems = checkHtml(html);
  if (problems.length === 0) return { html, status: 'ok', problems };

  let page = problems[0].startsWith('document is truncated') ? closeTruncated(html) : html;
  const remaining = checkHtml(page);
  if (remaining.length === 0) return { html: page, status: 'patched', problems };

  const text = await ask({
    model: MODELS.build,
    maxTokens: 2000,
    system:
      'You fix bugs in a single-file HTML page with minimal patches. Reply with JSON only: ' +
      '{"patches": [{"find": "exact snippet that appears exactly once in the page", "replace": "fixed snippet"}]}. ' +
      'Keep every snippet as short as possible.',
    prompt: `Problems found by automated checks:\n- ${remaining.join('\n- ')}\n\nPage:\n${page}`,
  });
  const { patches } = parseJson(text);
  page = applyPatches(page, Array.isArray(patches) ? patches : []);
  const left = checkHtml(page);
  return left.length === 0 ? { html: page, status: 'patched', problems } : { html, status: 'broken', problems: left };
}
