// Ashby public job board API: https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true (no key)
import { fetchJson } from '../http.mjs';
import { toIso } from '../text.mjs';
import { countryCodeFromName } from '../places.mjs';

const WORKPLACE = { remote: 'remote', hybrid: 'hybrid', onsite: 'onsite' };

function locOf(l) {
  const a = l?.address?.postalAddress ?? {};
  return { name: l?.location ?? [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(', '), country: a.addressCountry };
}

export async function fetchBoard(emp) {
  const r = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${emp.board}?includeCompensation=true`);
  if (!r.ok || !r.json) return { ok: false, status: r.status, jobs: [] };
  const jobs = (r.json.jobs ?? []).filter(j => j.isListed !== false).map(j => {
    const all = [locOf({ location: j.location, address: j.address }), ...(j.secondaryLocations ?? []).map(locOf)];
    const wp = WORKPLACE[String(j.workplaceType ?? '').toLowerCase().replace(/[^a-z]/g, '')] ?? (j.isRemote ? 'remote' : null);
    const comp = j.compensation ?? {};
    return {
      ats: 'ashby', board: emp.board, jobId: j.id,
      employer: emp.name, title: j.title,
      jobUrl: j.jobUrl, applyUrl: j.applyUrl || j.jobUrl,
      locations: [...new Set(all.map(l => l.name).filter(Boolean))],
      countryCodes: [...new Set(all.map(l => countryCodeFromName(l.country)).filter(Boolean))],
      workplace: wp,
      descriptionHtml: j.descriptionHtml ?? '',
      postedAt: toIso(j.publishedAt), updatedAt: null,
      department: j.department ?? null, employmentType: j.employmentType ?? null,
      salaryStructured: null,
      salaryText: comp.scrapeableCompensationSalarySummary || comp.compensationTierSummary || null,
    };
  });
  return { ok: true, status: r.status, jobs };
}
