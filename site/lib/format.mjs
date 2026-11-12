// Small formatting helpers shared by the site build. Wording rules: PRD B3 and CLAUDE.md
// (never "hidden" or "not on LinkedIn"; never "sponsored" unless the advert says so).
import { REGIONS, REGION_LABELS } from '../../sync/regions.mjs';
import { formatSalary } from '../../sync/salary.mjs';

export { formatSalary };

const names = new Intl.DisplayNames(['en'], { type: 'region' });
const NAME_FIX = { GB: 'United Kingdom', US: 'United States' };
export function countryName(cc) {
  if (!cc) return '';
  try { return NAME_FIX[cc] ?? names.of(cc) ?? cc; } catch { return cc; }
}

// For running text: "people living in the United States".
const THE = new Set(['US', 'GB', 'NL', 'PH', 'AE', 'CZ', 'DO', 'BS', 'GM', 'VA', 'CF', 'KY', 'MV', 'SC']);
export const countryInText = cc => (THE.has(cc) ? 'the ' : '') + countryName(cc);

export const esc =s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Whole days since 1970-01-01 (UTC). Search records carry days, not ISO strings, to stay small.
export const dayNum = iso => (iso ? Math.floor(Date.parse(iso) / 86400000) : null);

export function agoText(days) {
  if (days == null) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  const m = Math.round(days / 30.4);
  if (m < 12) return m === 1 ? 'a month ago' : `${m} months ago`;
  const y = Math.round(days / 365);
  return y === 1 ? 'a year ago' : `${y} years ago`;
}

// "munich" -> "Munich", "san-francisco" -> "San Francisco"
export const cityName = slug => String(slug ?? '').split(/[-\s]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

// The employer's original posting date (PROP-2), falling back to when we first saw it.
export const postedIso = j => j.postedAt ?? j.firstSeen;

// Short place text for cards: "Munich, Germany" / "Germany" / "3 places in United States".
export function placeText(j) {
  if (j.placesCount > 5) {
    const cs = j.located ?? [];
    return cs.length === 1 ? `${j.placesCount} places in ${countryName(cs[0])}` : `${j.placesCount} places`;
  }
  if (j.cities?.length) {
    const c = j.cities.slice(0, 2).map(x => `${cityName(x.city)}, ${countryName(x.country)}`);
    return c.join(' · ') + (j.cities.length > 2 ? ` +${j.cities.length - 2}` : '');
  }
  if (j.located?.length) return j.located.slice(0, 3).map(countryName).join(', ') + (j.located.length > 3 ? ` +${j.located.length - 3}` : '');
  return (j.locations ?? []).map(s => s.trim()).filter(Boolean).slice(0, 2).join(' · ');
}

// Who can apply, for remote jobs: "United States", "Europe", "anywhere", or null when unclear.
export function remoteReach(r) {
  if (!r || r.unclear) return null;
  if (r.worldwide) return 'anywhere';
  const parts = [...r.regions.map(g => REGION_LABELS[g]?.replace(/^the /, '') ?? g), ...r.countries.map(countryName)];
  if (!parts.length) return null;
  return parts.length > 4 ? `${parts.slice(0, 4).join(', ')} +${parts.length - 4}` : parts.join(', ');
}

// The card line (PRD B3 flow 1.5): "Remote: Europe", "Remote: anywhere", "On site: Berlin, Germany", "Hybrid: London, United Kingdom".
export function whereLine(j) {
  if (j.workType === 'remote') {
    const reach = remoteReach(j.remote);
    return reach ? `Remote: ${reach}` : 'Remote: where from is unclear';
  }
  const label = j.workType === 'hybrid' ? 'Hybrid' : 'On site';
  const p = placeText(j);
  return p ? `${label}: ${p}` : label;
}

// Countries whose residents may apply (for markup and the job page). Regions are expanded.
export function remoteCountries(r) {
  if (!r || r.unclear || r.worldwide) return [];
  const set = new Set(r.countries);
  for (const g of r.regions) for (const cc of REGIONS[g] ?? []) set.add(cc);
  for (const cc of r.excluded ?? []) set.delete(cc);
  return [...set];
}

// ATS employment types are free text; map only clear cases (Google's PROP-12 values).
export function employmentCode(t) {
  if (!t) return null;
  const s = String(t).toLowerCase();
  if (/intern|trainee|working_student|werkstudent/.test(s)) return 'INTERN';
  if (/part[-_ ]?time/.test(s)) return 'PART_TIME';
  if (/contract|freelance/.test(s)) return 'CONTRACTOR';
  if (/temporary|fixed[-_ ]?term|casual/.test(s)) return 'TEMPORARY';
  if (/full[-_ ]?time/.test(s)) return 'FULL_TIME';
  return null;
}
export const EMPLOYMENT_LABEL = { INTERN: 'Internship', PART_TIME: 'Part time', CONTRACTOR: 'Contract', TEMPORARY: 'Temporary or fixed term', FULL_TIME: 'Full time' };

export const ATS_NAME = { greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby', smartrecruiters: 'SmartRecruiters', recruitee: 'Recruitee', personio: 'Personio' };
