// Checks a built site against the markup and indexing rules (PRD B4 "Pages and markup";
// RULES - Google for Jobs J2, J5, J7, J8, J12, J17). Run after every build: node site/check.mjs [dir]
// Exits non-zero with a list of problems.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function walk(d, out = []) {
  for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); }
  return out;
}
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export function checkSite(dir, { maxFiles = Infinity } = {}) {
  const problems = [];
  const files = walk(dir);
  const rel = f => '/' + path.relative(dir, f).split(path.sep).join('/');
  const urlOf = f => rel(f).replace(/index\.html$/, '');
  const exists = p => {
    const clean = decodeURIComponent(p.split(/[?#]/)[0]);
    const f = path.join(dir, clean);
    return existsSync(f) && (statSync(f).isFile() || existsSync(path.join(f, 'index.html')));
  };
  if (files.length > maxFiles) problems.push(`${files.length} files, over the cap of ${maxFiles}`);

  const noindex = new Set();
  const stats = { pages: 0, jobPostings: 0, breadcrumbs: 0, linksChecked: 0, feeds: 0 };
  for (const f of files.filter(f => f.endsWith('.html'))) {
    const html = readFileSync(f, 'utf8');
    const url = urlOf(f);
    stats.pages++;
    if (/<meta name="robots" content="noindex">/.test(html)) noindex.add(url);
    if (!/<link rel="canonical" href="[^"]+">/.test(html)) problems.push(`${url}: no canonical`);
    const h1s = html.match(/<h1[\s>]/g) ?? [];
    if (h1s.length !== 1) problems.push(`${url}: ${h1s.length} h1 headings`);
    const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch { problems.push(`${url}: JSON-LD does not parse`); return {}; } });
    const jp = lds.filter(x => x['@type'] === 'JobPosting');
    if (jp.length && !url.startsWith('/job/')) problems.push(`${url}: JobPosting markup on a page that is not a job page`);
    if (lds.some(x => x['@type'] === 'BreadcrumbList')) stats.breadcrumbs++;
    else if (url.startsWith('/job/') || url.startsWith('/jobs/in/') || url.startsWith('/company/') || url.startsWith('/remote-jobs/') || /^\/jobs\/[a-z-]+\/(in\/[a-z-]+\/)?$/.test(url)) problems.push(`${url}: no BreadcrumbList`);
    if (url === '/' && !lds.some(x => x['@type'] === 'Organization')) problems.push('/: no Organization markup');
    for (const ld of jp) {
      stats.jobPostings++;
      if (noindex.has(url)) problems.push(`${url}: job page with markup is noindex (J17)`);
      for (const k of ['title', 'description', 'datePosted', 'hiringOrganization']) if (!ld[k]) problems.push(`${url}: JobPosting missing ${k}`);
      if (ld.directApply !== false) problems.push(`${url}: directApply is not false (J8)`);
      const h1 = decode((/<h1 class="h1">([\s\S]*?)<\/h1>/.exec(html) ?? [])[1] ?? '');
      if (h1 !== ld.title) problems.push(`${url}: markup title "${ld.title}" isn't the visible title "${h1}" (J2)`);
      if (!html.includes(`>${ld.hiringOrganization?.name?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;').replace(/"/g, '&quot;')}<`)) problems.push(`${url}: employer name not visible (J2)`);
      if (ld.jobLocationType === 'TELECOMMUTE') {
        if (!ld.applicantLocationRequirements?.length) problems.push(`${url}: remote job without an eligible country (J7)`);
        if (!/Fully remote/.test(html)) problems.push(`${url}: remote markup but the page doesn't say fully remote (J7)`);
      } else {
        const locs = [ld.jobLocation].flat();
        if (!locs.length || locs.some(l => !l?.address?.addressCountry)) problems.push(`${url}: jobLocation without addressCountry (PROP-5)`);
      }
      if (ld.baseSalary && !/stated by the employer/.test(html)) problems.push(`${url}: salary in markup but not shown (J2)`);
      if ((ld.description ?? '').length < 200) problems.push(`${url}: description too short (J2)`);
    }
    // Internal links must point at files that exist (no links to pages that weren't built).
    for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
      const h = decode(m[1]);
      if (h.startsWith('/jobs/?')) continue; // search links carry filters, not files
      stats.linksChecked++;
      if (!exists(h)) problems.push(`${url}: broken link ${h}`);
    }
  }

  // Sitemaps: every URL exists and is indexable; no noindex page is listed.
  const listed = new Set();
  for (const f of files.filter(f => /sitemaps[\\/].+\.xml$/.test(f))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/<loc>[^<]*?:\/\/[^/]+(\/[^<]*)<\/loc>/g)) listed.add(m[1]);
  }
  for (const u of listed) { if (!exists(u)) problems.push(`sitemap: ${u} does not exist`); if (noindex.has(u)) problems.push(`sitemap: ${u} is noindex (B4)`); }
  for (const u of noindex) if (listed.has(u)) problems.push(`${u}: noindex but in the sitemap`);

  for (const f of files.filter(f => f.endsWith('feed.xml'))) {
    stats.feeds++;
    const x = readFileSync(f, 'utf8');
    if (!/^<\?xml[\s\S]*<rss version="2.0"[\s\S]*<item>[\s\S]*<\/rss>\s*$/.test(x)) problems.push(`${rel(f)}: not a valid RSS feed with items`);
  }
  return { problems, stats: { ...stats, files: files.length, noindex: noindex.size, inSitemap: listed.size } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(here, '..', process.argv[2] ?? 'dist');
  const config = JSON.parse(readFileSync(path.join(here, '..', 'config.json'), 'utf8'));
  const { problems, stats } = checkSite(dir, { maxFiles: config.maxSiteFiles });
  console.log(JSON.stringify(stats));
  if (problems.length) { console.error(`${problems.length} problems:\n` + problems.slice(0, 50).join('\n')); process.exitCode = 1; }
  else console.log('Site check: no problems.');
}
