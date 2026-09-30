const SEARCH_OVERRIDES = { queenstown: 'Queenstown New Zealand' };
const MIN_WIDTH = 1600;
const cache = new Map();

async function lookup(location) {
  const name = location.replace(/^the\s+/i, '');
  const query = SEARCH_OVERRIDES[name.toLowerCase()] ?? name;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${query} landscape filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|size|mime',
    iiurlwidth: '2400',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'makerdaymaker/0.1 (Render Maker Day)' },
  });
  if (!res.ok) throw new Error(`commons: ${res.status}`);
  const body = await res.json();
  const pages = Object.values(body.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  const hit = pages.find((p) => {
    const info = p.imageinfo?.[0];
    return info && info.mime === 'image/jpeg' && info.width >= MIN_WIDTH && info.width > info.height * 1.2;
  });
  if (!hit) return null;
  const info = hit.imageinfo[0];
  return { url: info.thumburl ?? info.url, source: info.descriptionurl, title: hit.title.replace(/^File:/, '').replace(/\.\w+$/, '') };
}

export async function backgroundFor(location) {
  const key = location.toLowerCase();
  if (!cache.has(key)) {
    const pending = lookup(location).catch(() => {
      cache.delete(key);
      return null;
    });
    cache.set(key, pending);
  }
  return cache.get(key);
}
