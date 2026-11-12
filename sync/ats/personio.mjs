// Personio public XML feed: https://{board}.jobs.personio.de/xml (no key)
import { XMLParser } from 'fast-xml-parser';
import { politeFetch } from '../http.mjs';
import { toIso } from '../text.mjs';

const parser = new XMLParser({ ignoreAttributes: true, cdataPropName: false, isArray: n => ['position', 'jobDescription', 'additionalOffice'].includes(n) });

export async function fetchBoard(emp) {
  const r = await politeFetch(`https://${emp.board}.jobs.personio.de/xml`);
  if (!r.ok) return { ok: false, status: r.status, jobs: [] };
  let doc;
  try { doc = parser.parse(r.body); } catch { return { ok: false, status: r.status, jobs: [] }; }
  const positions = doc?.['workzag-jobs']?.position ?? [];
  const jobs = positions.map(p => {
    const desc = (p.jobDescriptions?.jobDescription ?? []).map(d => `<h3>${d.name ?? ''}</h3>${d.value ?? ''}`).join('');
    const offices = [p.office, ...(p.additionalOffices?.additionalOffice ?? [])].filter(Boolean).map(String);
    return {
      ats: 'personio', board: emp.board, jobId: String(p.id),
      employer: emp.name || p.subcompany, title: String(p.name ?? ''),
      jobUrl: `https://${emp.board}.jobs.personio.de/job/${p.id}`,
      applyUrl: `https://${emp.board}.jobs.personio.de/job/${p.id}#apply`,
      locations: offices, countryCodes: [], workplace: null,
      descriptionHtml: desc,
      postedAt: toIso(p.createdAt), updatedAt: null,
      department: p.department ?? null, employmentType: p.employmentType ?? null,
      salaryStructured: null,
    };
  });
  return { ok: true, status: r.status, jobs };
}
