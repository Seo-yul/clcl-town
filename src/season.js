// Seasonal themes. Dates are Korean time (KST) whatever the visitor's time zone.
// The season is decided once when the page opens; world.js, models.js, the sky and
// the minimap read it while the town is built.

const KST_OFFSET = 9 * 60 * 60 * 1000;

/** Themes in effect. initSeason() fills this in before the town is built. */
export const SEASON = { snow: false, christmas: false };

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
  return {
    snow: inRange(seasons?.snow, today),
    christmas: inRange(seasons?.christmas, today),
  };
}

const PREVIEW = {
  christmas: { snow: true, christmas: true },
  snow: { snow: true, christmas: false },
  off: { snow: false, christmas: false },
};

export function initSeason(seasons) {
  let s = seasonAt(seasons);
  // Dev server only: ?season=christmas|snow|off previews a theme on any date.
  // Production builds drop this, so nobody sees a theme before its dates.
  if (import.meta.env.DEV) {
    const preview = PREVIEW[new URLSearchParams(location.search).get('season')];
    if (preview) s = preview;
  }
  Object.assign(SEASON, s);
  return SEASON;
}
