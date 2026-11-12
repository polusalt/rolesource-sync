// Recruitee public offers API: https://{board}.recruitee.com/api/offers/ (no key)
import { fetchJson } from '../http.mjs';
import { toIso } from '../text.mjs';

const PERIODS = { year: 'year', yearly: 'year', month: 'month', monthly: 'month', week: 'week', day: 'day', daily: 'day', hour: 'hour', hourly: 'hour' };

export async function fetchBoard(emp) {
  const r = await fetchJson(`https://${emp.board}.recruitee.com/api/offers/`);
  if (!r.ok || !r.json) return { ok: false, status: r.status, jobs: [] };
  const jobs = (r.json.offers ?? []).filter(o => o.status === undefined || o.status === 'published').map(o => {
    const locs = (o.locations ?? []).map(l => [l.city, l.state, l.country].filter(Boolean).join(', '));
    const s = o.salary ?? {};
    return {
      ats: 'recruitee', board: emp.board, jobId: String(o.id),
      employer: emp.name || o.company_name, title: o.title,
      jobUrl: o.careers_url, applyUrl: o.careers_apply_url || o.careers_url,
      locations: locs.length ? locs : [o.location].filter(Boolean),
      countryCodes: [...new Set([o.country_code, ...(o.locations ?? []).map(l => l.country_code)].filter(Boolean).map(c => c.toUpperCase()))],
      workplace: o.remote ? 'remote' : o.hybrid ? 'hybrid' : o.on_site ? 'onsite' : null,
      descriptionHtml: `${o.description ?? ''}${o.requirements ? '<h3>Requirements</h3>' + o.requirements : ''}`,
      postedAt: toIso(o.published_at) ?? toIso(o.created_at), updatedAt: toIso(o.updated_at),
      department: o.department ?? null, employmentType: o.employment_type_code ?? null,
      salaryStructured: s.min || s.max ? { min: +s.min || null, max: +s.max || null, currency: s.currency ?? null, period: PERIODS[String(s.period ?? '').toLowerCase()] ?? null } : null,
    };
  });
  return { ok: true, status: r.status, jobs };
}
