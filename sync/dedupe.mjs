// One job per (employer, title, primary location). Keeps the earliest-posted copy.
import { normName } from './text.mjs';

export function dedupeKey(j) {
  const loc = j.ukCity ?? normName((j.locations ?? [])[0] ?? '');
  return [normName(j.employer), normName(j.title).replace(/\s+/g, ' '), loc, j.workType].join('|');
}

export function dedupe(jobs) {
  const best = new Map();
  for (const j of jobs) {
    const k = dedupeKey(j);
    const cur = best.get(k);
    if (!cur || (j.postedAt && (!cur.postedAt || j.postedAt < cur.postedAt))) best.set(k, j);
  }
  const { jobs: out, merged } = mergeMassPosted([...best.values()]);
  return { jobs: out, removed: jobs.length - out.length, massMerged: merged };
}

// Mass-posted adverts: one employer posting the same title in many places (e.g. "Personal Trainer" in 4,455 US
// towns, seen 12 Nov 2026) would bury every other job. Above MASS_POSTED copies they become ONE listing: the
// earliest copy, with every country it covers (so country filters still find it) and a count of places.
// Its cities are dropped so it doesn't fill thousands of city pages.
export const MASS_POSTED = 20;
export function mergeMassPosted(jobs, limit = MASS_POSTED) {
  const groups = new Map();
  for (const j of jobs) {
    const k = [normName(j.employer), normName(j.title).replace(/\s+/g, ' '), j.workType].join('|');
    (groups.get(k) ?? groups.set(k, []).get(k)).push(j);
  }
  const out = [];
  let merged = 0;
  for (const g of groups.values()) {
    if (g.length <= limit) { out.push(...g); continue; }
    g.sort((a, b) => String(a.postedAt ?? '9').localeCompare(String(b.postedAt ?? '9')));
    const located = [...new Set(g.flatMap(j => j.located ?? []))];
    out.push({ ...g[0], located, cities: [], locations: g.slice(0, 5).flatMap(j => j.locations ?? []).slice(0, 5), placesCount: g.length });
    merged += g.length - 1;
  }
  return { jobs: out, merged };
}
