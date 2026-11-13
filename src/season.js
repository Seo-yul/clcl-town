// Seasonal themes. Dates are Korean time (KST) whatever the visitor's time zone.
// The season is decided once when the page opens; world.js, models.js, the sky and
// the minimap read it while the town is built.

const KST_OFFSET = 9 * 60 * 60 * 1000;

/** Themes in effect. initSeason() fills this in before the town is built. */
export const SEASON = { spring: false, summer: false, autumn: false, snow: false, christmas: false, newyear: false };

// The four base seasons show one at a time. If their dates overlap, the first in this list wins.
const BASE = ['snow', 'autumn', 'summer', 'spring'];

function monthDay(text) {
  const [m, d] = text.split('-').map(Number);
  return m * 100 + d;
}

/** Whether `today` (MMDD as a number) is within an inclusive 'MM-DD' range. A range may wrap past New Year. */
export function inRange(range, today) {
  if (!range || !range.from || !range.to) return false;
  const from = monthDay(range.from);
  const to = monthDay(range.to);
  return from <= to ? today >= from && today <= to : today >= from || today <= to;
}

/** Which themes are on at `now`, judged by the date in Korea. */
export function seasonAt(seasons, now = Date.now()) {
  const kst = new Date(now + KST_OFFSET);
  const today = (kst.getUTCMonth() + 1) * 100 + kst.getUTCDate();
  const base = BASE.find((k) => inRange(seasons?.[k], today));
  const s = Object.fromEntries(BASE.map((k) => [k, k === base]));
  s.christmas = inRange(seasons?.christmas, today);
  s.newyear = inRange(seasons?.newyear, today);
  return s;
}

const OFF = { spring: false, summer: false, autumn: false, snow: false, christmas: false, newyear: false };
const PREVIEW = {
  spring: { ...OFF, spring: true },
  summer: { ...OFF, summer: true },
  autumn: { ...OFF, autumn: true },
  snow: { ...OFF, snow: true },
  christmas: { ...OFF, snow: true, christmas: true },
  newyear: { ...OFF, snow: true, newyear: true },
  off: OFF,
};

export function initSeason(seasons) {
  let s = seasonAt(seasons);
  // Dev server only: ?season=spring|summer|autumn|snow|christmas|newyear|off previews a theme on any date.
  // Production builds drop this, so nobody sees a theme before its dates.
  if (import.meta.env.DEV) {
    const preview = PREVIEW[new URLSearchParams(location.search).get('season')];
    if (preview) s = preview;
  }
  Object.assign(SEASON, s);
  return SEASON;
}
