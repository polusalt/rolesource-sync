// Lever Postings API: https://api.lever.co/v0/postings/{site}?mode=json (EU accounts: api.eu.lever.co). No key needed to read.
import { fetchJson } from '../http.mjs';
import { toIso } from '../text.mjs';

const PERIODS = { 'per-year-salary': 'year', 'per-month-salary': 'month', 'per-week-salary': 'week', 'per-day-wage': 'day', 'per-hour-wage': 'hour', 'one-time': null };
const WORKPLACE = { remote: 'remote', hybrid: 'hybrid', onsite: 'onsite', 'on-site': 'onsite' };

export async function fetchBoard(emp) {
  const host = emp.region === 'eu' ? 'api.eu.lever.co' : 'api.lever.co';
  const r = await fetchJson(`https://${host}/v0/postings/${emp.board}?mode=json`);
  if (!r.ok || !Array.isArray(r.json)) return { ok: false, status: r.status, jobs: [] };
  const jobs = r.json.map(j => {
    const lists = (j.lists ?? []).map(l => `<h3>${l.text}</h3><ul>${l.content}</ul>`).join('');
    const sr = j.salaryRange;
    return {
      ats: 'lever', board: emp.board, jobId: j.id,
      employer: emp.name, title: j.text,
      jobUrl: j.hostedUrl, applyUrl: j.applyUrl || j.hostedUrl,
      locations: [...new Set([j.categories?.location, ...(j.categories?.allLocations ?? [])].filter(Boolean))],
      countryCodes: j.country ? [String(j.country).toUpperCase()] : [],
      workplace: WORKPLACE[j.workplaceType] ?? null,
      descriptionHtml: `${j.description ?? ''}${lists}${j.additional ?? ''}`,
      postedAt: toIso(j.createdAt), updatedAt: null,
      department: j.categories?.department ?? j.categories?.team ?? null,
      employmentType: j.categories?.commitment ?? null,
      salaryStructured: sr && (sr.min || sr.max) ? { min: sr.min ?? null, max: sr.max ?? null, currency: sr.currency ?? null, period: PERIODS[sr.interval] ?? null } : null,
    };
  });
  return { ok: true, status: r.status, jobs };
}
