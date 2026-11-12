// Page bodies. Static pages show absolute dates ("checked 12 Nov 2026") because they may be read days
// after the build; search results (rendered in the browser) show relative ones.
import { esc, countryName, countryInText, whereLine, formatSalary, postedIso, remoteCountries, employmentCode, EMPLOYMENT_LABEL, ATS_NAME, placeText, remoteReach } from './format.mjs';
import { page, icon } from './layout.mjs';
import { breadcrumbLd } from './browse.mjs';
import { ldScript } from './jsonld.mjs';
import { ROLES, jobPath } from './shards.mjs';

const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const nf = n => n.toLocaleString('en-GB');

export function cardHtml(j, href, gen) {
  const ext = !href.startsWith('/');
  const sal = formatSalary(j.salary);
  return `<article class="card">
<p class="strip">Checked ${esc(fmtDate(gen))} · posted ${esc(fmtDate(postedIso(j)))}</p>
<div class="card-in">
<h3 class="card-t"><a href="${esc(href)}"${ext ? ' rel="nofollow noopener" target="_blank"' : ''}>${esc(j.title)}</a></h3>
<p class="card-co">${esc(j.employer)}</p>
<p class="card-where">${icon.globe}${esc(whereLine(j))}</p>
${sal ? `<p class="card-sal">${esc(sal)}</p>` : ''}${ext ? `<p class="card-ext">Opens on ${esc(j.employer)}'s own site</p>` : ''}
</div>
</article>`;
}

function countryOptions(index, selected = '') {
  const cs = Object.entries(index.sets).filter(([k]) => k.length === 2).map(([k, v]) => [k, countryName(k), v.n]).sort((a, b) => a[1].localeCompare(b[1]));
  return `<option value="">Anywhere (no filter)</option>` + cs.map(([k, n, c]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(n)} (${nf(c)})</option>`).join('');
}

export function homePage({ site, index, stats, latest, hrefOf, built = new Map() }) {
  const topCountries = Object.entries(index.sets).filter(([k]) => k.length === 2).sort((a, b) => b[1].n - a[1].n).slice(0, 18);
  const roleCounts = index.sets.all.roles ?? {};
  const topRoles = ROLES.filter(([s]) => s !== 'other').map(([s, l]) => [s, l, roleCounts[s] ?? 0]).filter(r => r[2] > 0).sort((a, b) => b[2] - a[2]).slice(0, 16);
  const body = `
<section class="hero wrap">
  <div class="hero-panel">
    <h1 class="display">Jobs straight from employers' own career sites</h1>
    <p class="lede">${nf(stats.jobs)} live jobs from ${nf(stats.employers)} employers' own job boards, on site, hybrid and remote, in ${nf(stats.countries)} countries. Checked every day.</p>
    <form class="hero-form" action="/jobs/" method="get" role="search">
      <label class="fld"><span>Job title or keyword</span><input name="q" type="search" placeholder="e.g. product designer" autocomplete="off"></label>
      <label class="fld"><span>I can apply from</span><select name="from" data-default-from>${countryOptions(index)}</select></label>
      <button class="btn btn-ink btn-lg" type="submit">Search jobs</button>
    </form>
  </div>
</section>

<section class="wrap saved" id="saved" hidden>
  <h2 class="h2">Your saved searches</h2>
  <ul class="saved-list" data-saved-list></ul>
</section>

<section class="wrap chips-sec">
  <h2 class="h2">Browse by role</h2>
  <p class="chips">${topRoles.map(([s, l, n]) => `<a class="chip" href="${built.get(`role|${s}`)?.path ?? `/jobs/?role=${s}`}">${esc(l)} <span>${nf(n)}</span></a>`).join('')}</p>
  <h2 class="h2">Where you can apply from</h2>
  <p class="chips">${topCountries.map(([k, v]) => `<a class="chip" href="/jobs/?from=${k}">${esc(countryName(k))} <span>${nf(v.n)}</span></a>`).join('')}</p>
</section>

<section class="grid-sec">
  <div class="wrap">
    <div class="stats">
      <div class="stat"><p class="strip">Employers read</p><p class="stat-in"><b>${nf(stats.employers)}</b><span>companies' own job boards, through their public Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee and Personio feeds</span></p></div>
      <div class="stat"><p class="strip">Last check</p><p class="stat-in"><b>${esc(fmtDate(index.gen))}</b><span>every board is read once a day; jobs that close are removed at the next check</span></p></div>
    </div>
    <h2 class="h2">Newest jobs</h2>
    <div class="cards">${latest.map(j => cardHtml(j, hrefOf(j), index.gen)).join('\n')}</div>
    <p class="more"><a class="btn btn-line" href="/jobs/">See all ${nf(stats.jobs)} jobs</a></p>
  </div>
</section>`;
  return page({
    site, path: '/', title: 'RoleSource: jobs straight from employers\' career sites',
    description: `Search ${nf(stats.jobs)} live jobs taken straight from ${nf(stats.employers)} employers' own job boards. Filter by where you can apply from. Free, no sign-up.`,
    body, scripts: ['/home.js'],
    head: ldScript({ '@context': 'https://schema.org', '@type': 'Organization', name: 'RoleSource', url: site.url + '/' }),
  });
}

export function searchPage({ site, index }) {
  const roleOpts = `<option value="">Any role</option>` + ROLES.map(([s, l]) => `<option value="${s}">${esc(l)}</option>`).join('');
  const body = `
<div class="wrap search-head">
  <h1 class="h1">Search jobs direct from employers</h1>
  <p class="muted" data-status role="status" aria-live="polite">Loading jobs…</p>
</div>
<div class="grid-sec"><div class="wrap search-grid">
  <form class="filters" data-filters role="search" aria-label="Job filters">
    <div class="sheet-head"><p class="h3">Filters</p><button type="button" class="btn btn-line" data-close-filters>Done</button></div>
    <label class="fld"><span>Job title, keyword or company</span><input name="q" type="search" autocomplete="off"></label>
    <label class="fld"><span>I can apply from</span><select name="from">${countryOptions(index)}</select></label>
    <label class="chk" data-unclear-wrap hidden><input type="checkbox" name="unclear" value="1"> Also show remote jobs that don't say where you can work from</label>
    <label class="fld"><span>Role</span><select name="role">${roleOpts}</select></label>
    <label class="fld"><span>Place (city or country)</span><input name="loc" type="text" autocomplete="off" placeholder="e.g. Berlin"></label>
    <fieldset class="fld"><legend>Work type</legend>
      <label class="chk"><input type="checkbox" name="wt" value="onsite"> On site</label>
      <label class="chk"><input type="checkbox" name="wt" value="hybrid"> Hybrid</label>
      <label class="chk"><input type="checkbox" name="wt" value="remote"> Remote</label>
    </fieldset>
    <label class="fld"><span>Posted</span><select name="days"><option value="">Any time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
    <label class="chk"><input type="checkbox" name="sal" value="1"> Salary stated</label>
    <label class="chk"><input type="checkbox" name="visa" value="1"> Advert says visa sponsorship is available</label>
    <button type="button" class="btn btn-line" data-save>Save this search</button>
    <p class="muted small" data-save-msg role="status" aria-live="polite"></p>
  </form>
  <section class="results" aria-label="Results">
    <button type="button" class="btn btn-line filters-open" data-open-filters>Filters <span data-filter-count></span></button>
    <div class="cards" data-results></div>
    <p class="more"><button type="button" class="btn btn-line" data-more hidden>Show more</button></p>
  </section>
</div></div>
<noscript><p class="wrap">Search needs JavaScript. You can still browse the <a href="/">newest jobs</a>.</p></noscript>`;
  return page({ site, path: '/jobs/', title: 'Search jobs direct from employers | RoleSource', description: 'Search live jobs from employers\' own career sites. Filter by where you can apply from, work type, salary and visa wording.', body, scripts: ['/search.js'], bodyClass: 'is-search' });
}

export function jobPage({ site, j, html, ld, gen, crumbs, companyHref }) {
  const path = jobPath(j);
  const sal = formatSalary(j.salary);
  const et = employmentCode(j.employmentType);
  const reach = j.workType === 'remote' ? remoteReach(j.remote) : null;
  const ccs = j.workType === 'remote' ? remoteCountries(j.remote) : [];
  const who = j.workType === 'remote'
    ? (j.remote?.worldwide ? 'Fully remote. The advert is open to people anywhere.'
      : reach ? `Fully remote. Open to people living in ${ccs.length > 12 ? reach : ccs.map(countryInText).join(', ')}.`
        : 'Fully remote. The advert doesn\'t say where you can work from; check it before applying.')
    : `${j.workType === 'hybrid' ? 'Hybrid' : 'On site'} in ${placeText(j) || 'the location given by the employer'}.`;
  const visa = j.advertSponsorship === 'yes' ? 'Advert says visa sponsorship is available.' : j.advertSponsorship === 'no' ? 'Advert says visa sponsorship is not available.' : '';
  const trail = crumbs ?? [['Jobs', '/jobs/'], [j.title, path]];
  const body = `
<div class="wrap job">
  <nav class="crumbs" aria-label="Breadcrumb">${trail.map(([nm, p], i) => (i === trail.length - 1 ? `<span>${esc(nm)}</span>` : `<a href="${p}">${esc(nm)}</a>`)).join(' › ')}</nav>
  <header class="job-head">
    <h1 class="h1">${esc(j.title)}</h1>
    <p class="job-co">${companyHref ? `<a href="${companyHref}">${esc(j.employer)}</a>` : esc(j.employer)}</p>
  </header>
  <div class="job-grid">
    <aside class="facts" aria-label="Job summary">
      <p class="strip">Checked ${esc(fmtDate(gen))}</p>
      <dl>
        <div><dt>Where</dt><dd>${icon.globe}${esc(whereLine(j))}</dd></div>
        <div><dt>Who can apply</dt><dd>${esc(who)}</dd></div>
        ${sal ? `<div><dt>Salary</dt><dd>${esc(sal)} <span class="muted">(stated by the employer)</span></dd></div>` : ''}
        ${et ? `<div><dt>Employment</dt><dd>${EMPLOYMENT_LABEL[et]}</dd></div>` : ''}
        ${visa ? `<div><dt>Visa</dt><dd>${visa}</dd></div>` : ''}
        <div><dt>Posted</dt><dd>${esc(fmtDate(postedIso(j)))}</dd></div>
      </dl>
      <a class="btn btn-apply" href="${esc(j.applyUrl)}" rel="nofollow noopener" target="_blank">Apply on ${esc(j.employer)}'s site</a>
      <p class="muted small">From ${esc(j.employer)}'s own careers page (${ATS_NAME[j.ats] ?? j.ats}). We read it daily and remove this page when the job closes.</p>
    </aside>
    <article class="advert">${html}</article>
  </div>
</div>
<div class="apply-bar"><a class="btn btn-apply" href="${esc(j.applyUrl)}" rel="nofollow noopener" target="_blank">Apply on ${esc(j.employer)}'s site</a></div>`;
  const where = j.workType === 'remote' ? `Remote${reach ? ` (${reach})` : ''}` : placeText(j);
  return page({
    site, path, title: `${j.title} at ${j.employer}${where ? `, ${where}` : ''} | RoleSource`,
    description: `${j.title} at ${j.employer}. ${whereLine(j)}.${sal ? ` ${sal}.` : ''} Full advert from the employer's own careers page, checked ${fmtDate(gen)}.`,
    body, head: (ld ? ldScript(ld) : '') + breadcrumbLd(site, trail), bodyClass: 'is-job',
  });
}

export function howPage({ site, stats, gen }) {
  const body = `
<div class="wrap prose">
  <h1 class="h1">How RoleSource works</h1>
  <p class="lede">Every job here comes straight from an employer's own careers page. We don't take jobs from LinkedIn, Indeed or other job boards, and we don't copy careers pages by scraping them.</p>
  <h2 class="h2">Where the jobs come from</h2>
  <p>Many employers run their careers page on a hiring system such as Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee or Personio. These systems publish each employer's open jobs in a public feed. RoleSource reads those feeds for ${nf(stats.employers)} employers. Recruitment agencies, job boards and freelance marketplaces are left out.</p>
  <h2 class="h2">Checked every day</h2>
  <p>Every feed is read once a day. The last check was on ${esc(fmtDate(gen))}. When a job disappears from an employer's feed, its page here is removed at the next check, so you shouldn't find closed jobs.</p>
  <h2 class="h2">What "can apply from" means</h2>
  <p>For on-site and hybrid jobs, it is the country the job is in. For remote jobs, we read the advert's own words, such as "must be based in Canada" or "open to candidates across Europe", to find who can apply. If an advert doesn't say, the job is marked "where from is unclear" and only shows when you ask for those jobs.</p>
  <h2 class="h2">Salary and visas</h2>
  <p>A salary is shown only when the employer states one. Commission-only and on-target earnings are not shown as salary. Visa sponsorship is mentioned only when the advert itself says it is or isn't available.</p>
  <h2 class="h2">Only English-language adverts, for now</h2>
  <p>RoleSource lists adverts written in English. Employers who post in other languages may have more jobs than you see here.</p>
</div>`;
  return page({ site, path: '/how-it-works/', title: 'How RoleSource works', description: 'Where RoleSource\'s jobs come from, how often they are checked, and what the "can apply from" tags mean.', body });
}

export function notFoundPage({ site }) {
  const body = `
<div class="wrap prose nf">
  <h1 class="h1">This job has closed, or the page doesn't exist</h1>
  <p class="lede">Job pages are removed when the employer takes the job down. The employer may have similar jobs open.</p>
  <p><a class="btn btn-ink" href="/jobs/">Search open jobs</a></p>
</div>`;
  return page({ site, path: '/404.html', title: 'Page not found | RoleSource', description: 'This job has closed or the page does not exist.', body, noindex: true });
}

export function checkerPage({ site, stats }) {
  const body = `
<div class="wrap prose checker">
  <h1 class="h1">Is this job real? Check it on the employer's site</h1>
  <p class="lede">Paste a job link from anywhere, including LinkedIn. We look for the same job among the ${nf(stats.jobs)} live jobs on ${nf(stats.employers)} employers' own careers pages, checked every day.</p>
  <form class="check-form" data-checker>
    <label class="fld"><span>Job link</span><input name="url" type="url" inputmode="url" placeholder="https://…" autocomplete="off"></label>
    <p class="muted small">Or type the company and job title:</p>
    <div class="check-two">
      <label class="fld"><span>Company</span><input name="company" type="text" autocomplete="off"></label>
      <label class="fld"><span>Job title</span><input name="title" type="text" autocomplete="off"></label>
    </div>
    <button class="btn btn-ink" type="submit">Check</button>
  </form>
  <div class="check-result" data-check-result role="status" aria-live="polite"></div>
  <h2 class="h2">What the answers mean</h2>
  <p><strong>Live on the employer's own site:</strong> the job is open on the employer's careers page today, and we link to it.</p>
  <p><strong>Not found on the employer's site:</strong> it may have closed, or the employer never posted it there. That doesn't prove a job is not real; some employers post only through recruiters.</p>
  <p><strong>We don't track this employer yet:</strong> the employer isn't among the boards we read, so we can't tell.</p>
  <p class="muted small">We never open the link you paste. For LinkedIn and Indeed links we only read the words in the link itself.</p>
</div>`;
  return page({ site, path: '/is-this-job-real/', title: 'Is this job real? Check it on the employer\'s site | RoleSource', description: 'Paste a job link, including from LinkedIn, and see whether the job is live on the employer\'s own careers page today.', body, scripts: ['/checker.js'] });
}
