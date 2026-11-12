// SmartRecruiters public Posting API: list https://api.smartrecruiters.com/v1/companies/{id}/postings,
// detail /postings/{postingId}. The list has no advert text, so details are fetched only for jobs that could be
// UK-eligible (UK location or remote) and cached by id + release date, so each advert is fetched once.
import { fetchJson } from '../http.mjs';
import { toIso } from '../text.mjs';

const MAX_PAGES = 100; // 10,000 postings

export async function fetchBoard(emp, { detailCache = {} } = {}) {
  const base = `https://api.smartrecruiters.com/v1/companies/${emp.board}/postings`;
  const list = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await fetchJson(`${base}?limit=100&offset=${page * 100}`);
    if (!r.ok || !r.json) { if (page === 0) return { ok: false, status: r.status, jobs: [] }; break; }
    list.push(...(r.json.content ?? []));
    if (list.length >= (r.json.totalFound ?? 0) || !(r.json.content ?? []).length) break;
  }
  const candidates = list.filter(p => String(p.location?.country ?? '').toLowerCase() === 'gb' || p.location?.remote);
  const jobs = [];
  for (const p of candidates) {
    const key = `${p.id}@${p.releasedDate}`;
    let d = detailCache[key];
    if (!d) {
      const r = await fetchJson(`${base}/${p.id}`);
      if (!r.ok || !r.json) continue;
      const s = r.json.jobAd?.sections ?? {};
      d = {
        html: ['companyDescription', 'jobDescription', 'qualifications', 'additionalInformation']
          .map(k => s[k]?.text ? `<h3>${s[k].title ?? ''}</h3>${s[k].text}` : '').join(''),
        postingUrl: r.json.postingUrl, applyUrl: r.json.applyUrl,
      };
      detailCache[key] = d;
    }
    const loc = p.location ?? {};
    jobs.push({
      ats: 'smartrecruiters', board: emp.board, jobId: String(p.id),
      employer: emp.name || p.company?.name, title: p.name,
      jobUrl: d.postingUrl || `https://jobs.smartrecruiters.com/${emp.board}/${p.id}`,
      applyUrl: d.applyUrl || d.postingUrl || `https://jobs.smartrecruiters.com/${emp.board}/${p.id}`,
      locations: [loc.fullLocation || [loc.city, loc.region, loc.country].filter(Boolean).join(', ')].filter(Boolean),
      countryCodes: loc.country ? [String(loc.country).toUpperCase()] : [],
      workplace: loc.remote ? 'remote' : loc.hybrid ? 'hybrid' : 'onsite',
      descriptionHtml: d.html,
      postedAt: toIso(p.releasedDate), updatedAt: null,
      department: p.department?.label ?? p.function?.label ?? null,
      employmentType: p.typeOfEmployment?.label ?? null,
      experienceLevel: p.experienceLevel?.id ?? null,
      salaryStructured: null,
    });
  }
  return { ok: true, status: 200, jobs, listed: list.length };
}
