// Builds the static site from the sync output.
//   node site/build.mjs                         -> reads data/, writes dist/
//   node site/build.mjs --data data/sample --pages 300   (small local build: the owner's PC has little disk)
// Options: --data <dir> --out <dir> --pages <n> (job-page cap override) --site-url <https://...>
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildShards, selectPages, jobPath } from './lib/shards.mjs';
import { jobPosting } from './lib/jsonld.mjs';
import { homePage, searchPage, jobPage, howPage, notFoundPage, checkerPage, cardHtml } from './lib/pages.mjs';
import { browseGroups, browsePage, rssFeed, countryPath, cityPath, cityKey } from './lib/browse.mjs';
import { countryName, cityName, whereLine, formatSalary } from './lib/format.mjs';
import { BUCKETS, bucketOf, boardKeys, normJobUrl } from './assets/checker.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const config = JSON.parse(readFileSync(path.join(root, 'config.json'), 'utf8'));

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const dataDir = path.resolve(root, opt('data', 'data'));
const outDir = path.resolve(root, opt('out', 'dist'));
const pageCap = Math.min(config.maxJobPages, Number(opt('pages', config.maxJobPages)));
const site = { url: (opt('site-url', process.env.SITE_URL ?? config.siteUrl ?? 'http://localhost:8788')).replace(/\/$/, '') };

if (!outDir.startsWith(root + path.sep)) throw new Error(`Refusing to write outside the project: ${outDir}`);

const t0 = Date.now();
const { jobs, generatedAt } = JSON.parse(readFileSync(path.join(dataDir, 'jobs.json'), 'utf8'));
const gen = generatedAt ?? new Date().toISOString();

// Full adverts live in 256 shards keyed by md5(id) prefix (sync/run.mjs).
const advertShards = new Map();
function advertHtml(id) {
  const k = createHash('md5').update(id).digest('hex').slice(0, 2);
  if (!advertShards.has(k)) {
    const f = path.join(dataDir, 'adverts', `${k}.json`);
    advertShards.set(k, existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {});
  }
  return advertShards.get(k)[id] ?? '';
}

// Jobs without a full advert can't have a page (no thin pages, no markup without a description).
const withAdvert = jobs.filter(j => advertHtml(j.id).length >= 200);
let pages = selectPages(withAdvert, pageCap);
let { files, index } = buildShards(jobs, pages, gen);
const groups = browseGroups(jobs);
const built = new Map(groups.map(x => [`${x.kind}|${x.key}`, x]));
const browseFiles = groups.length + groups.filter(x => x.indexed).length + BUCKETS + 1; // pages, feeds, checker data
const FIXED_FILES = 45; // other pages, assets, fonts, sitemaps, robots
const room = config.maxSiteFiles - files.size - browseFiles - FIXED_FILES - Math.ceil(pages.size / 45000);
if (pages.size > room) {
  console.log(`File cap: trimming job pages from ${pages.size} to ${room} (maxSiteFiles ${config.maxSiteFiles}).`);
  pages = selectPages(withAdvert, room);
  ({ files, index } = buildShards(jobs, pages, gen));
}

rmSync(outDir, { recursive: true, force: true });
let fileCount = 0;
const write = (rel, content) => {
  const f = path.join(outDir, rel);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, content);
  fileCount++;
};

// Assets
for (const name of readdirSync(path.join(here, 'assets'))) { copyFileSync(path.join(here, 'assets', name), path.join((mkdirSync(outDir, { recursive: true }), outDir), name)); fileCount++; }
const fonts = {
  'work-sans-latin.woff2': '@fontsource-variable/work-sans/files/work-sans-latin-wght-normal.woff2',
  'work-sans-latin-ext.woff2': '@fontsource-variable/work-sans/files/work-sans-latin-ext-wght-normal.woff2',
  'bricolage-latin.woff2': '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
  'bricolage-latin-ext.woff2': '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-ext-wght-normal.woff2',
};
mkdirSync(path.join(outDir, 'fonts'), { recursive: true });
for (const [to, from] of Object.entries(fonts)) { copyFileSync(path.join(root, 'node_modules', from), path.join(outDir, 'fonts', to)); fileCount++; }

// Search shards
let biggest = { rel: '', gz: 0 };
for (const [rel, obj] of files) {
  const s = JSON.stringify(obj);
  write(`s/${rel}`, s);
  const gz = gzipSync(s).length;
  if (gz > biggest.gz) biggest = { rel, gz };
}
write('s/index.json', JSON.stringify(index));

// Pages
const hrefOf = j => (pages.has(j.id) ? jobPath(j) : j.jobUrl);
const stats = { jobs: jobs.length, employers: new Set(jobs.map(j => j.employer)).size, countries: new Set(jobs.flatMap(j => j.located ?? [])).size };
// Newest jobs on the home page: at most 2 per employer, so one big board can't fill the list.
const perCo = new Map();
const latest = [...jobs].filter(j => pages.has(j.id)).sort((a, b) => (b.postedAt ?? '').localeCompare(a.postedAt ?? ''))
  .filter(j => { const n = perCo.get(j.employer) ?? 0; perCo.set(j.employer, n + 1); return n < 2; }).slice(0, 12);
write('index.html', homePage({ site, index, stats, latest, hrefOf, built }));
write('jobs/index.html', searchPage({ site, index }));
write('how-it-works/index.html', howPage({ site, stats, gen }));
write('404.html', notFoundPage({ site }));

let marked = 0;
const jobUrls = [];
for (const j of jobs) {
  if (!pages.has(j.id)) continue;
  const html = advertHtml(j.id);
  const ld = jobPosting(j, html);
  if (ld) marked++;
  const p = jobPath(j);
  const cc = j.located?.[0];
  const city = j.cities?.find(c => c.country === cc);
  const crumbs = [['Jobs', '/jobs/']];
  if (cc && built.get(`country|${cc}`)) crumbs.push([countryName(cc), countryPath(cc)]);
  if (city && built.get(`city|${cc}|${cityKey(city.city)}`)) crumbs.push([cityName(cityKey(city.city)), cityPath(cc, city.city)]);
  crumbs.push([j.title, p]);
  write(`${p.slice(1)}index.html`, jobPage({ site, j, html, ld, gen, crumbs, companyHref: built.get(`company|${j.employerSlug}`)?.path }));
  jobUrls.push(p);
}

// Browse pages and their RSS feeds
const browseUrls = [];
for (const x of groups) {
  write(`${x.path.slice(1)}index.html`, browsePage({ site, x, gen, built, cardHtml, hrefOf }));
  if (x.indexed) {
    write(`${x.path.slice(1)}feed.xml`, rssFeed({ site, x, gen, hrefOf, whereLine, formatSalary }));
    browseUrls.push(x.path);
  }
}

// Job checker: employer index plus 64 bucket files of each employer's live jobs
const empIndex = new Map();
const buckets = Array.from({ length: BUCKETS }, () => ({}));
for (const j of jobs) {
  if (!empIndex.has(j.employerSlug)) empIndex.set(j.employerSlug, [j.employer, j.employerSlug, new Set()]);
  for (const k of boardKeys(j.jobUrl)) if (k.includes('/') || !/^(greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com)$/.test(k)) empIndex.get(j.employerSlug)[2].add(k);
  (buckets[bucketOf(j.employerSlug)][j.employerSlug] ??= []).push([j.title, hrefOf(j), String(j.atsJobId ?? ''), normJobUrl(j.jobUrl)]);
}
write('s/emp/index.json', JSON.stringify({ gen, e: [...empIndex.values()].map(([n, s, k]) => [n, s, [...k]]) }));
buckets.forEach((b, i) => write(`s/emp/${i}.json`, JSON.stringify(b)));
write('is-this-job-real/index.html', checkerPage({ site, stats }));

// Sitemaps (job URLs in files of at most 45,000) and robots
const day = gen.slice(0, 10);
const urlset = urls => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${site.url}${u}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`;
const maps = ['sitemaps/pages.xml'];
write('sitemaps/pages.xml', urlset(['/', '/jobs/', '/how-it-works/', '/is-this-job-real/', ...browseUrls]));
for (let i = 0; i * 45000 < jobUrls.length; i++) { const rel = `sitemaps/jobs-${i + 1}.xml`; write(rel, urlset(jobUrls.slice(i * 45000, (i + 1) * 45000))); maps.push(rel); }
write('sitemap-index.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${maps.map(m => `<sitemap><loc>${site.url}/${m}</loc><lastmod>${day}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
// Until launch (phase 6 checks), the live site asks every crawler to stay away.
write('robots.txt', config.launched
  ? `User-agent: *\nDisallow: /s/\nSitemap: ${site.url}/sitemap-index.xml\n`
  : `# Not launched yet: please don't crawl.\nUser-agent: *\nDisallow: /\n`);
if (config.indexNowKey) write(`${config.indexNowKey}.txt`, config.indexNowKey); // IndexNow ownership key (public by design)

if (fileCount > config.maxSiteFiles) throw new Error(`Site has ${fileCount} files, over maxSiteFiles ${config.maxSiteFiles}.`);

const report = {
  builtAt: new Date().toISOString(), dataGeneratedAt: gen, seconds: Math.round((Date.now() - t0) / 1000),
  jobs: jobs.length, jobPages: pages.size, jobPagesWithMarkup: marked, searchFiles: files.size + 1, files: fileCount,
  browsePages: groups.length, browseIndexed: browseUrls.length,
  browseByKind: Object.fromEntries(['country', 'city', 'role', 'roleCountry', 'remote', 'company'].map(k => [k, groups.filter(x => x.kind === k).length])),
  biggestSearchFileGzipKB: Math.round(biggest.gz / 1024), biggestSearchFile: biggest.rel,
};
writeFileSync(path.join(dataDir, 'build-report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
// Any search file can be the first one loaded (a role picked in the URL), so all must fit PRD B4's 1.5 MB.
if (biggest.gz > 1.5 * 1024 * 1024) { console.error(`Search file ${biggest.rel} is over 1.5 MB compressed (PRD B4).`); process.exitCode = 1; }
