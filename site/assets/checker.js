// "Is this job real?" checker (PRD B3 flow 3). Runs in the browser over /s/emp/ files; never fetches the pasted URL.
// LinkedIn and Indeed links are read as text only (PRD B4). It never says a job is "fake".
export const BUCKETS = 64;

// FNV-1a; the build uses the same function to place each employer in a bucket file.
export function bucketOf(slug) {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) { h ^= slug.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % BUCKETS;
}

// One host name per hiring system, so job-boards.greenhouse.io and boards.greenhouse.io match.
const ATS_HOSTS = [[/(^|\.)greenhouse\.io$/, 'greenhouse.io'], [/(^|\.)lever\.co$/, 'lever.co'], [/(^|\.)ashbyhq\.com$/, 'ashbyhq.com'], [/(^|\.)smartrecruiters\.com$/, 'smartrecruiters.com']];
export function normHost(h) {
  h = h.toLowerCase().replace(/^www\./, '');
  for (const [re, v] of ATS_HOSTS) if (re.test(h)) return v;
  return h;
}

// Keys that identify an employer's board from a URL: "greenhouse.io/acme" (path-based systems) or "acme.recruitee.com".
export function boardKeys(url) {
  let u;
  try { u = new URL(url); } catch { return []; }
  const host = normHost(u.hostname);
  const seg = u.pathname.split('/').filter(Boolean);
  const keys = [];
  if (seg[0] && ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'smartrecruiters.com'].includes(host)) keys.push(`${host}/${decodeURIComponent(seg[0]).toLowerCase()}`);
  keys.push(host);
  return keys;
}

// A job URL without query, hash or trailing slash, with a normalised host.
export function normJobUrl(url) {
  try {
    const u = new URL(url);
    return `${normHost(u.hostname)}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch { return ''; }
}

const STOP = new Set(['and', 'the', 'of', 'for', 'a', 'an', 'in', 'at', 'to', 'with', 'm', 'f', 'd', 'w', 'x', 'remote', 'hybrid']);
export const tokens = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9+#]+/).filter(t => t && !STOP.has(t));
export function titleScore(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const t of A) if (B.has(t)) both++;
  return both / Math.max(A.size, B.size);
}
export const normName = s => tokens(String(s).replace(/\b(inc|ltd|llc|gmbh|plc|limited|corp|corporation|co|ag|sa|bv|group|holdings|technologies|technology)\b\.?/gi, ' ')).join(' ');

// LinkedIn job URLs often carry "<title>-at-<company>-<id>" in the path. Read that text only.
export function readLinkedIn(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const m = /\/jobs\/view\/([^/?#]+)/.exec(u.pathname);
  const slug = m ? decodeURIComponent(m[1]).replace(/-?\d+$/, '') : '';
  const at = slug.lastIndexOf('-at-');
  if (at < 0) return { site: 'LinkedIn', title: '', company: '' };
  return { site: 'LinkedIn', title: slug.slice(0, at).replace(/-/g, ' '), company: slug.slice(at + 4).replace(/-/g, ' ') };
}
export const isIndeed = url => { try { return /(^|\.)indeed\./i.test(new URL(url).hostname); } catch { return false; } };

// Employer index: { gen, e: [[name, slug, [boardKeys]]] }. Buckets: { slug: [[title, href, atsJobId, normJobUrl]] }.
export function findEmployer(index, { keys = [], name = '' }) {
  if (keys.length) {
    for (const k of keys) { const e = index.e.find(x => x[2].includes(k)); if (e) return e; }
  }
  const n = normName(name);
  if (!n) return null;
  return index.e.find(x => normName(x[0]) === n) ?? index.e.find(x => normName(x[1].replace(/-/g, ' ')) === n)
    ?? (n.length >= 4 ? index.e.find(x => normName(x[0]).startsWith(n + ' ') || n.startsWith(normName(x[0]) + ' ')) : null) ?? null;
}

// Returns { state: 'live' | 'maybe' | 'notfound' | 'untracked' | 'needtext', employer, jobs: [[title, href, score]] }.
export function check(index, bucket, input) {
  const { url = '', company = '', title = '' } = input;
  if (url) {
    const li = readLinkedIn(url);
    if (li) {
      if (!li.company && !company) return { state: 'needtext', site: 'LinkedIn' };
      return check(index, bucket, { company: company || li.company, title: title || li.title });
    }
    if (isIndeed(url) && !company) return { state: 'needtext', site: 'Indeed' };
    if (!isIndeed(url)) {
      const emp = findEmployer(index, { keys: boardKeys(url) });
      if (!emp) return { state: 'untracked' };
      const jobs = bucket(emp) ?? [];
      const nu = normJobUrl(url);
      const idHit = jobs.find(j => j[3] === nu || (j[2] && nu.split('/').some(p => p === String(j[2]).toLowerCase() || p.startsWith(`${String(j[2]).toLowerCase()}-`))));
      const gh = (() => { try { return new URL(url).searchParams.get('gh_jid'); } catch { return null; } })();
      const ghHit = gh && jobs.find(j => String(j[2]) === gh);
      const hit = idHit || ghHit;
      return hit ? { state: 'live', employer: emp, jobs: [[hit[0], hit[1], 1]] } : { state: 'notfound', employer: emp };
    }
  }
  const emp = findEmployer(index, { name: company });
  if (!emp) return { state: 'untracked' };
  const jobs = (bucket(emp) ?? []).map(j => [j[0], j[1], titleScore(title, j[0])]).filter(j => j[2] >= 0.5).sort((a, b) => b[2] - a[2]).slice(0, 5);
  if (!title) return { state: 'notfound', employer: emp };
  if (jobs.length && jobs[0][2] >= 0.8) return { state: 'live', employer: emp, jobs };
  if (jobs.length) return { state: 'maybe', employer: emp, jobs };
  return { state: 'notfound', employer: emp };
}

// ---------- Page ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function initChecker(form) {
  const out = document.querySelector('[data-check-result]');
  const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  let index;
  try { index = await get('/s/emp/index.json'); } catch { out.textContent = 'The checker could not load. Please refresh the page.'; return; }
  const checked = new Date(index.gen).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const files = new Map();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const input = { url: form.url.value.trim(), company: form.company.value.trim(), title: form.title.value.trim() };
    if (!input.url && !input.company) { out.innerHTML = '<p>Paste a job link, or type the company and job title.</p>'; return; }
    out.innerHTML = '<p>Checking…</p>';
    // Load the bucket file for whichever employer the input points at.
    const pre = check(index, () => null, input);
    let data = null;
    if (pre.employer) {
      const b = bucketOf(pre.employer[1]);
      if (!files.has(b)) files.set(b, get(`/s/emp/${b}.json`));
      data = await files.get(b).catch(() => null);
    }
    const r = check(index, emp => (data && Object.hasOwn(data, emp[1]) ? data[emp[1]] : []), input);
    const co = r.employer ? esc(r.employer[0]) : '';
    const links = (r.jobs ?? []).map(([t, h]) => `<li><a href="${esc(h)}"${h.startsWith('/') ? '' : ' rel="nofollow noopener" target="_blank"'}>${esc(t)}</a></li>`).join('');
    out.innerHTML = {
      live: `<p class="res res-live"><strong>Live on ${co}'s own site</strong> (checked ${checked}).</p><ul>${links}</ul>`,
      maybe: `<p class="res"><strong>Not an exact match.</strong> ${co} has these similar jobs live on its own site (checked ${checked}):</p><ul>${links}</ul>`,
      notfound: `<p class="res"><strong>Not found on ${co}'s site.</strong> It may be closed, or never posted there (checked ${checked}).</p>`,
      untracked: '<p class="res"><strong>We don\'t track this employer yet.</strong> Check the employer\'s own careers page directly.</p>',
      needtext: `<p class="res">${esc(r.site)} links don't include the company and job title. Type them in the boxes below the link.</p>`,
    }[r.state];
  });
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('[data-checker]');
  if (form) initChecker(form);
}
