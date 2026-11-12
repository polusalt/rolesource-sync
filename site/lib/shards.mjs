// Search data, split so the browser never downloads every job at once (PRD B4: first shard <= 1.5 MB compressed).
// One set per "I can apply from" country, plus "all" (no country) and "unclear" (remote jobs whose reach is unclear).
// A big set is split by role family, with a "recent" file of the newest jobs loaded first.
import { openTo } from '../../sync/where.mjs';
import { ROLE_FAMILIES } from '../../sync/classify.mjs';
import { REGIONS } from '../../sync/regions.mjs';
import { whereLine, formatSalary, dayNum, postedIso } from './format.mjs';

export const SPLIT_OVER = 3000; // sets bigger than this are split by role family
export const RECENT = 2000;     // newest jobs in a split set's first file
export const PART = 10000;      // at most this many jobs in one role file (about 0.6 MB compressed)
export const ROLES = [...ROLE_FAMILIES.map(([slug, label]) => [slug, label]), ['other', 'Other']];
const ROLE_INDEX = Object.fromEntries(ROLES.map(([s], i) => [s, i]));
const WT = { onsite: 0, hybrid: 1, remote: 2 };

export const jobPath = j => `/job/${j.id}-${String(j.slug).slice(0, 80).replace(/-+$/, '')}/`;

// Which "apply from" countries a job belongs to. Unclear remote jobs belong to none (PRD B4).
export function openCountries(j, universe) {
  if (j.workType !== 'remote' || !j.remote) return j.located ?? [];
  const r = j.remote;
  if (r.unclear) return [];
  if (r.worldwide) return [...universe].filter(cc => !r.excluded.includes(cc));
  const set = new Set(r.countries);
  for (const g of r.regions) for (const cc of REGIONS[g] ?? []) set.add(cc);
  return [...set].filter(cc => openTo(j, cc));
}

// Compact record: [id, title, company#, where, workType, salary, postedDay, firstSeenDay, url, role#, flags, places]
function record(j, co, pages) {
  let ci = co.idx.get(j.employer);
  if (ci == null) { ci = co.list.length; co.list.push(j.employer); co.idx.set(j.employer, ci); }
  const flags = (j.advertSponsorship === 'yes' ? 1 : 0) | (j.advertSponsorship === 'no' ? 2 : 0) | (j.remote?.unclear ? 4 : 0);
  const places = (j.locations ?? []).join(' · ').slice(0, 140);
  return [j.id, j.title, ci, whereLine(j), WT[j.workType] ?? 0, formatSalary(j.salary), dayNum(postedIso(j)), dayNum(j.firstSeen),
    pages.has(j.id) ? jobPath(j) : j.jobUrl, ROLE_INDEX[j.role] ?? ROLE_INDEX.other, flags, places];
}

function file(jobs, pages) {
  const co = { list: [], idx: new Map() };
  const j = jobs.map(x => record(x, co, pages));
  return { co: co.list, j };
}

const newestFirst = (a, b) => (postedIso(b) ?? '').localeCompare(postedIso(a) ?? '');

// Returns { files: Map(path -> object), index } with paths relative to /s/.
export function buildShards(jobs, pages, generatedAt) {
  const universe = new Set();
  for (const j of jobs) for (const cc of j.located ?? []) universe.add(cc);
  for (const j of jobs) if (j.remote && !j.remote.unclear) { for (const cc of j.remote.countries) universe.add(cc); }
  for (const g of Object.values(REGIONS)) for (const cc of g) universe.add(cc);

  const sets = new Map([['all', []], ['unclear', []]]);
  for (const j of jobs) {
    sets.get('all').push(j);
    if (j.workType === 'remote' && j.remote?.unclear) sets.get('unclear').push(j);
    for (const cc of openCountries(j, universe)) {
      if (!sets.has(cc)) sets.set(cc, []);
      sets.get(cc).push(j);
    }
  }

  const files = new Map();
  const index = { gen: generatedAt, roles: ROLES, sets: {} };
  for (const [key, list] of sets) {
    list.sort(newestFirst);
    const dir = key === 'all' || key === 'unclear' ? key : `c/${key}`;
    if (list.length <= SPLIT_OVER) {
      files.set(`${dir}.json`, file(list, pages));
      index.sets[key] = { n: list.length };
      continue;
    }
    const byRole = {};
    for (const j of list) (byRole[j.role in ROLE_INDEX ? j.role : 'other'] ??= []).push(j);
    files.set(`${dir}/recent.json`, file(list.slice(0, RECENT), pages));
    const roles = {};
    const parts = {};
    for (const [r, l] of Object.entries(byRole)) {
      roles[r] = l.length;
      if (l.length <= PART) { files.set(`${dir}/${r}.json`, file(l, pages)); continue; }
      // A very big role (e.g. US "other") is cut into parts so no file passes PRD B4's 1.5 MB.
      parts[r] = Math.ceil(l.length / PART);
      for (let i = 0; i < parts[r]; i++) files.set(`${dir}/${r}.${i + 1}.json`, file(l.slice(i * PART, (i + 1) * PART), pages));
    }
    index.sets[key] = { n: list.length, split: true, roles, ...(Object.keys(parts).length ? { parts } : {}) };
  }
  return { files, index };
}

// Which jobs get their own page (PRD: capped). Newest first, salary-stated jobs nudged up,
// at most `perEmployer` per employer so one big board can't take the whole cap.
export function selectPages(jobs, cap, perEmployer = 150) {
  const scored = jobs
    .filter(j => j.located?.length || j.workType === 'remote')
    .map(j => ({ j, s: (dayNum(postedIso(j)) ?? 0) + (j.salary ? 14 : 0) }))
    .sort((a, b) => b.s - a.s);
  const per = new Map();
  const out = new Set();
  for (const { j } of scored) {
    if (out.size >= cap) break;
    const n = per.get(j.employer) ?? 0;
    if (n >= perEmployer) continue;
    per.set(j.employer, n + 1);
    out.add(j.id);
  }
  return out;
}
