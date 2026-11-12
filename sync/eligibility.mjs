// UK view of whereCanApply(): the label set used by the hand-labelled samples (tests/fixtures/LABELLING.md).
// The product itself uses where.mjs for any country; this wrapper keeps the UK-labelled tests meaningful.
//   uk-onsite, uk-hybrid, remote-uk, remote-europe, remote-worldwide, remote-unclear, exclude
import { whereCanApply, openTo } from './where.mjs';
import { regionIncludes } from './regions.mjs';

export function classifyEligibility(job) {
  const w = whereCanApply(job);
  const ukCity = w.cities.find(c => c.country === 'GB')?.city ?? null;
  const r = (eligibility) => ({ eligibility, ukCity, workType: w.workType, reason: w.reason, where: w });
  if (!w.remote) return r(w.located.includes('GB') ? (w.workType === 'hybrid' ? 'uk-hybrid' : 'uk-onsite') : 'exclude');
  const s = w.remote;
  if (s.countries.includes('GB') && !s.excluded.includes('GB')) return r('remote-uk');
  if (s.excluded.includes('GB')) return r('exclude');
  if (s.worldwide) return r('remote-worldwide');
  if (s.regions.some(g => g !== 'world' && regionIncludes(g, 'GB'))) return r('remote-europe');
  if (s.unclear) return r('remote-unclear');
  return r('exclude');
}

export { openTo };
export const UK_ELIGIBLE = new Set(['uk-onsite', 'uk-hybrid', 'remote-uk', 'remote-europe', 'remote-worldwide']);
export const REMOTE_FROM_UK = new Set(['remote-uk', 'remote-europe', 'remote-worldwide']);
