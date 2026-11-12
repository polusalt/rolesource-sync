// Browse pages (PRD B3, B7): country, city, role, role x country, remote-from-country and company pages.
// A page is built only with at least BUILD_MIN live jobs ("empty combos are not generated", J12), and is
// indexed only above the PRD B7 threshold; below it, it gets noindex and stays out of the sitemap (B4).
import { slugify } from '../../sync/text.mjs';
import { ROLE_FAMILIES } from '../../sync/classify.mjs';
import { openTo } from '../../sync/where.mjs';
import { esc, countryName, countryInText, cityName, postedIso } from './format.mjs';
import { page } from './layout.mjs';
import { ldScript } from './jsonld.mjs';

export const BUILD_MIN = 5;
export const INDEX_MIN = { country: 50, city: 20, role: 5, roleCountry: 10, remote: 10, company: 5 };
export const LIST_MAX = 50; // newest jobs listed on a browse page (company pages list up to 200)

const ROLE_LABEL = Object.fromEntries(ROLE_FAMILIES.map(([s, l]) => [s, l]));
// The same city under two names would make two pages.
const CITY_ALIAS = { 'new york city': 'new york', nyc: 'new york', sf: 'san francisco', bengaluru: 'bangalore', 'washington dc': 'washington', 'washington d c': 'washington', gurugram: 'gurgaon' };
export const cityKey = c => CITY_ALIAS[c] ?? c;

export const countryPath = cc => `/jobs/in/${slugify(countryName(cc))}/`;
export const cityPath = (cc, city) => `${countryPath(cc)}${slugify(cityKey(city))}/`;
export const rolePath = r => `/jobs/${r}/`;
export const roleCountryPath = (r, cc) => `/jobs/${r}/in/${slugify(countryName(cc))}/`;
export const remotePath = cc => `/remote-jobs/from/${slugify(countryName(cc))}/`;
export const companyPath = slug => `/company/${slugify(slug)}/`;

// Employer's own careers page, from one of its job URLs.
export function boardUrl(j) {
  try {
    const u = new URL(j.jobUrl);
    const seg = u.pathname.split('/').filter(Boolean);
    if (/greenhouse\.io$|lever\.co$|ashbyhq\.com$|smartrecruiters\.com$/.test(u.hostname) && seg[0]) return `${u.origin}/${seg[0]}`;
    return u.origin;
  } catch { return null; }
}

// Groups every job into the pages it belongs to. Returns [{ kind, key, path, jobs, ... }].
export function browseGroups(jobs) {
  const g = new Map();
  const add = (kind, key, path, j, extra) => {
    const id = `${kind}|${key}`;
    if (!g.has(id)) g.set(id, { kind, key, path, jobs: [], ...extra });
    g.get(id).jobs.push(j);
  };
  const remoteCountries = new Set();
  for (const j of jobs) {
    for (const cc of j.located ?? []) {
      add('country', cc, countryPath(cc), j, { cc });
      if (j.role && j.role !== 'other') add('roleCountry', `${j.role}|${cc}`, roleCountryPath(j.role, cc), j, { role: j.role, cc });
    }
    if (j.placesCount <= 20 || j.placesCount == null) { // mass-posted jobs get no city pages (CLAUDE.md)
      const seen = new Set();
      for (const c of j.cities ?? []) {
        const k = `${c.country}|${cityKey(c.city)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        add('city', k, cityPath(c.country, c.city), j, { cc: c.country, city: cityKey(c.city) });
      }
    }
    if (j.role && j.role !== 'other') add('role', j.role, rolePath(j.role), j, { role: j.role });
    if (j.employerSlug) add('company', j.employerSlug, companyPath(j.employerSlug), j, { employer: j.employer });
    if (j.workType === 'remote' && j.remote && !j.remote.unclear) {
      for (const cc of j.remote.countries) remoteCountries.add(cc);
      for (const cc of j.located ?? []) remoteCountries.add(cc);
    }
  }
  // Remote from a country: every remote job open to it (country, region or worldwide).
  const remoteJobs = jobs.filter(j => j.workType === 'remote' && j.remote && !j.remote.unclear);
  for (const cc of new Set([...remoteCountries, ...[...g.values()].filter(x => x.kind === 'country').map(x => x.cc)])) {
    for (const j of remoteJobs) if (openTo(j, cc)) add('remote', cc, remotePath(cc), j, { cc });
  }
  const out = [];
  for (const x of g.values()) {
    if (x.jobs.length < BUILD_MIN) continue;
    x.indexed = x.jobs.length >= INDEX_MIN[x.kind];
    x.jobs.sort((a, b) => (postedIso(b) ?? '').localeCompare(postedIso(a) ?? ''));
    out.push(x);
  }
  return out;
}

const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
const nf = n => n.toLocaleString('en-GB');
const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function counts(list, keyOf) {
  const m = new Map();
  for (const j of list) for (const k of [keyOf(j)].flat()) if (k) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function breadcrumbLd(site, crumbs) {
  return ldScript({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: site.url + path })) });
}

// Text for each kind of page. `name` is how the page names itself in running text.
function words(x) {
  const c = x.cc && countryInText(x.cc); // "the United Kingdom" in running text and headings
  switch (x.kind) {
    case 'country': return { h1: `Jobs in ${c}`, title: `Jobs in ${c} direct from employers`, where: `in ${countryInText(x.cc)}`, search: `/jobs/?from=${x.cc}`, searchLabel: `Search every job you can apply for from ${c}` };
    case 'city': return { h1: `Jobs in ${cityName(x.city)}`, title: `Jobs in ${cityName(x.city)}, ${countryName(x.cc)} direct from employers`, where: `in ${cityName(x.city)}`, search: `/jobs/?from=${x.cc}&loc=${encodeURIComponent(cityName(x.city))}`, searchLabel: `Search jobs in ${cityName(x.city)}` };
    case 'role': return { h1: `${ROLE_LABEL[x.role]} jobs`, title: `${ROLE_LABEL[x.role]} jobs direct from employers`, where: 'worldwide', search: `/jobs/?role=${x.role}`, searchLabel: `Search ${ROLE_LABEL[x.role].toLowerCase()} jobs` };
    case 'roleCountry': return { h1: `${ROLE_LABEL[x.role]} jobs in ${c}`, title: `${ROLE_LABEL[x.role]} jobs in ${c} direct from employers`, where: `in ${countryInText(x.cc)}`, search: `/jobs/?role=${x.role}&from=${x.cc}`, searchLabel: `Search ${ROLE_LABEL[x.role].toLowerCase()} jobs you can apply for from ${c}` };
    case 'remote': return { h1: `Remote jobs you can do from ${c}`, title: `Remote jobs you can do from ${c}`, where: `open to people in ${countryInText(x.cc)}`, search: `/jobs/?from=${x.cc}&wt=remote`, searchLabel: `Search remote jobs open to ${c}` };
    case 'company': return { h1: `${x.employer} jobs`, title: `${x.employer} jobs`, where: `at ${x.employer}`, search: `/jobs/?q=${encodeURIComponent(x.employer)}`, searchLabel: `Search ${x.employer} jobs` };
  }
}

// `built` = Map(kind|key -> group) so pages only link to pages that exist.
export function browsePage({ site, x, gen, built, cardHtml, hrefOf }) {
  const w = words(x);
  const n = x.jobs.length;
  const wt = counts(x.jobs, j => j.workType);
  const wtText = wt.map(([k, v]) => `${pct(v, n)}% ${k === 'onsite' ? 'on site' : k}`).join(', ');
  const sal = x.jobs.filter(j => j.salary).length;
  const employers = counts(x.jobs, j => j.employerSlug);
  const nameOf = new Map(x.jobs.map(j => [j.employerSlug, j.employer]));
  const link = (kind, key, label, num) => {
    const g = built.get(`${kind}|${key}`);
    return g ? `<a class="chip" href="${g.path}">${esc(label)} <span>${nf(num)}</span></a>` : `<span class="chip chip-plain">${esc(label)} <span>${nf(num)}</span></span>`;
  };

  // Related links: what is useful to move to from each kind of page.
  const rel = [];
  if (x.kind !== 'company') rel.push(['Employers hiring', employers.slice(0, 16).map(([s, v]) => link('company', s, nameOf.get(s), v))]);
  if (x.kind === 'country' || x.kind === 'roleCountry') rel.push(['Cities', counts(x.jobs, j => (j.cities ?? []).filter(c => c.country === x.cc).map(c => cityKey(c.city))).slice(0, 16).map(([k, v]) => link('city', `${x.cc}|${k}`, cityName(k), v))]);
  if (x.kind === 'country' || x.kind === 'city' || x.kind === 'company') rel.push(['Roles', counts(x.jobs, j => (j.role !== 'other' ? j.role : null)).slice(0, 16).map(([r, v]) => (x.cc ? link('roleCountry', `${r}|${x.cc}`, ROLE_LABEL[r], v) : link('role', r, ROLE_LABEL[r], v)))]);
  if (x.kind === 'role') rel.push(['Countries', counts(x.jobs, j => j.located ?? []).slice(0, 16).map(([cc, v]) => link('roleCountry', `${x.role}|${cc}`, countryName(cc), v))]);
  if (x.kind === 'company') rel.push(['Countries', counts(x.jobs, j => j.located ?? []).slice(0, 16).map(([cc, v]) => link('country', cc, countryName(cc), v))]);
  if (x.kind === 'country' && built.get(`remote|${x.cc}`)) rel.push(['Remote', [`<a class="chip" href="${remotePath(x.cc)}">Remote jobs you can do from ${esc(countryName(x.cc))}</a>`]]);

  const crumbs = [['Jobs', '/jobs/']];
  if (x.kind === 'city' || x.kind === 'roleCountry') { if (x.kind === 'roleCountry') crumbs.push([ROLE_LABEL[x.role], rolePath(x.role)]); else if (built.get(`country|${x.cc}`)) crumbs.push([countryName(x.cc), countryPath(x.cc)]); }
  crumbs.push([w.h1, x.path]);

  const list = x.jobs.slice(0, x.kind === 'company' ? 200 : LIST_MAX);
  const careers = x.kind === 'company' ? boardUrl(x.jobs[0]) : null;
  const feed = x.indexed ? `${x.path}feed.xml` : null;
  const intro = `${nf(n)} live ${n === 1 ? 'job' : 'jobs'} ${w.where}${x.kind === 'company' ? '' : ` from ${nf(employers.length)} ${employers.length === 1 ? 'employer' : 'employers'}' own careers pages`}, checked ${fmtDate(gen)}. ${wtText}.${sal ? ` ${pct(sal, n)}% state a salary.` : ''}`;

  const body = `
<div class="wrap browse">
  <nav class="crumbs" aria-label="Breadcrumb">${crumbs.map(([nm, p], i) => (i === crumbs.length - 1 ? `<span>${esc(nm)}</span>` : `<a href="${p}">${esc(nm)}</a>`)).join(' › ')}</nav>
  <h1 class="h1">${esc(w.h1)}</h1>
  <p class="lede">${esc(intro)}</p>
  ${careers ? `<p><a href="${esc(careers)}" rel="nofollow noopener" target="_blank">${esc(x.employer)}'s own careers page</a></p>` : ''}
  <p class="browse-actions"><a class="btn btn-ink" href="${esc(w.search)}">${esc(w.searchLabel)}</a>${feed ? ` <a class="btn btn-line" href="${feed}">RSS feed</a>` : ''}</p>
  ${rel.filter(([, items]) => items.length).map(([h, items]) => `<h2 class="h2">${esc(h)}</h2><p class="chips">${items.join('')}</p>`).join('\n')}
</div>
<section class="grid-sec"><div class="wrap">
  <h2 class="h2">${n > list.length ? `Newest ${list.length} of ${nf(n)} jobs` : 'Live jobs'}</h2>
  <div class="cards">${list.map(j => cardHtml(j, hrefOf(j), gen)).join('\n')}</div>
  ${n > list.length ? `<p class="more"><a class="btn btn-line" href="${esc(w.search)}">See all ${nf(n)}</a></p>` : ''}
</div></section>`;
  return page({
    site, path: x.path, title: `${w.title} | RoleSource`, description: intro.slice(0, 300), body, noindex: !x.indexed,
    head: breadcrumbLd(site, crumbs) + (feed ? `\n<link rel="alternate" type="application/rss+xml" title="${esc(w.title)}" href="${feed}">` : ''),
  });
}

const xmlEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

// RSS 2.0 feed of a page's newest jobs (PRD: RSS instead of email alerts).
export function rssFeed({ site, x, gen, hrefOf, whereLine, formatSalary }) {
  const w = words(x);
  const abs = h => (h.startsWith('/') ? site.url + h : h);
  const items = x.jobs.slice(0, LIST_MAX).map(j => `<item><title>${xmlEsc(`${j.title} at ${j.employer}`)}</title><link>${xmlEsc(abs(hrefOf(j)))}</link><guid isPermaLink="false">${j.id}</guid><pubDate>${new Date(postedIso(j)).toUTCString()}</pubDate><description>${xmlEsc([whereLine(j), formatSalary(j.salary)].filter(Boolean).join('. '))}</description></item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${xmlEsc(w.title)} | RoleSource</title><link>${site.url}${x.path}</link><description>${xmlEsc(`Newest jobs ${w.where}, from employers' own careers pages.`)}</description>
<atom:link href="${site.url}${x.path}feed.xml" rel="self" type="application/rss+xml"/><lastBuildDate>${new Date(gen).toUTCString()}</lastBuildDate>
${items}
</channel></rss>
`;
}
