// Greenhouse Job Board API: https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true (no key needed)
import { fetchJson } from '../http.mjs';
import { decodeEntities, toIso } from '../text.mjs';

export async function fetchBoard(emp) {
  // EU-hosted boards (job-boards.eu.greenhouse.io) answer on this same API host (checked 8 Nov 2026).
  const r = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${emp.board}/jobs?content=true`);
  if (!r.ok || !r.json) return { ok: false, status: r.status, jobs: [] };
  const jobs = (r.json.jobs ?? []).map(j => {
    const locs = [j.location?.name, ...(j.offices ?? []).map(o => o.location || o.name)].filter(Boolean);
    return {
      ats: 'greenhouse', board: emp.board, jobId: String(j.id),
      employer: emp.name || j.company_name, title: j.title,
      jobUrl: j.absolute_url, applyUrl: j.absolute_url,
      locations: [...new Set(locs)], countryCodes: [], workplace: null,
      descriptionHtml: decodeEntities(j.content ?? ''),
      postedAt: toIso(j.first_published) ?? toIso(j.updated_at), updatedAt: toIso(j.updated_at),
      department: j.departments?.[0]?.name ?? null, employmentType: null,
      salaryStructured: null,
    };
  });
  return { ok: true, status: r.status, jobs };
}
