const DEFAULT_YEAR = 2027;

function yearFromEnv(value) {
  const year = Number.parseInt(value ?? '', 10);
  return year >= 2000 && year <= 3000 ? year : DEFAULT_YEAR;
}

export const YEAR = yearFromEnv(process.env.MAKER_DAY_YEAR);
export const LOCATION = process.env.MAKER_DAY_LOCATION || 'San Francisco';

export const PROJECTED_HEADCOUNT = {
  2027: 220,
  2028: 740,
  2029: 1010,
  2030: 1500,
  2031: 2050,
  2032: 2700,
  2033: 3450,
  2034: 4300,
  2035: 5250,
  2036: 6250,
  2037: 7300,
  2038: 8400,
  2039: 9550,
  2040: 10750,
  2041: 12000,
  2042: 13300,
};
const GROWTH_AFTER_PROJECTIONS = 1.1;
const MAX_HEADCOUNT = 50000;

const EXOTIC_LOCATIONS = [
  'Bali',
  'Reykjavík',
  'Queenstown',
  'Santorini',
  'Kyoto',
  'Marrakech',
  'Patagonia',
  'Svalbard',
  'the Maldives',
  'Zanzibar',
  'the Galápagos Islands',
  'Bora Bora',
  'the Seychelles',
  'Tulum',
  'Antarctica',
];

export function headcountFor(year, previous) {
  if (PROJECTED_HEADCOUNT[year]) return PROJECTED_HEADCOUNT[year];
  if (year < DEFAULT_YEAR) return PROJECTED_HEADCOUNT[DEFAULT_YEAR];
  if (previous) return Math.round(previous * GROWTH_AFTER_PROJECTIONS);
  const lastKnown = Math.max(...Object.keys(PROJECTED_HEADCOUNT).map(Number));
  return Math.round(PROJECTED_HEADCOUNT[lastKnown] * GROWTH_AFTER_PROJECTIONS ** (year - lastKnown));
}

export const DEFAULT_CONFIG = { year: YEAR, location: LOCATION, headcount: headcountFor(YEAR) };

export function parseConfig(input = {}) {
  const year = Number.parseInt(input.year, 10);
  const headcount = Number.parseInt(input.headcount, 10);
  const location = typeof input.location === 'string' ? input.location.trim().slice(0, 60) : '';
  return {
    year: year >= 2000 && year <= 3000 ? year : DEFAULT_CONFIG.year,
    location: location || DEFAULT_CONFIG.location,
    headcount: headcount > 0 && headcount <= MAX_HEADCOUNT ? headcount : DEFAULT_CONFIG.headcount,
  };
}

export function nextConfig({ year, headcount }) {
  const next = year + 1;
  const exotic = (next - YEAR) % 2 === 1;
  return {
    year: next,
    location: exotic ? EXOTIC_LOCATIONS[Math.floor(Math.random() * EXOTIC_LOCATIONS.length)] : LOCATION,
    headcount: headcountFor(next, headcount),
  };
}
