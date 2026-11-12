// RoleSource search: runs in the browser over the JSON files in /s/ (built by site/lib/shards.mjs).
// Record: [id, title, company#, where, workType, salary, postedDay, firstSeenDay, url, role#, flags, places]
const WT = ['onsite', 'hybrid', 'remote'];
const PAGE = 50;
const today = () => Math.floor(Date.now() / 86400000);
const fileCache = new Map();

export async function getJSON(url) {
  if (!fileCache.has(url)) fileCache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }));
  return fileCache.get(url);
}
export const loadIndex = () => getJSON('/s/index.json');

const dirOf = key => (key === 'all' || key === 'unclear' ? key : `c/${key}`);

// Files needed for a set. `full` = every role file (needed when filtering without a role).
export function filesFor(index, key, role, full) {
  const s = index.sets[key];
  if (!s) return [];
  const dir = dirOf(key);
  if (!s.split) return [`/s/${dir}.json`];
  const roleFiles = r => { const n = s.parts?.[r]; return n ? Array.from({ length: n }, (_, i) => `/s/${dir}/${r}.${i + 1}.json`) : [`/s/${dir}/${r}.json`]; };
  if (role) return s.roles[role] ? roleFiles(role) : [];
  return full ? Object.keys(s.roles).flatMap(roleFiles) : [`/s/${dir}/recent.json`];
}

export function decode(data, index) {
  return data.j.map(a => {
    const co = data.co[a[2]];
    return { id: a[0], t: a[1], co, w: a[3], wt: WT[a[4]], sal: a[5], pd: a[6], fd: a[7], u: a[8], r: index.roles[a[9]][0], f: a[10], pl: a[11],
      hay: `${a[1]} ${co}`.toLowerCase(), place: `${a[3]} ${a[11]}`.toLowerCase() };
  });
}

// Each file is decoded once; later filter changes reuse the same objects (PRD B4: updates under 300 ms).
const decodedCache = new Map();
const decoded = (url, index) => {
  if (!decodedCache.has(url)) decodedCache.set(url, getJSON(url).then(d => decode(d, index)));
  return decodedCache.get(url);
};

export function readParams(sp) {
  return { q: (sp.get('q') || '').trim(), from: sp.get('from') || '', role: sp.get('role') || '', loc: (sp.get('loc') || '').trim(),
    wt: sp.getAll('wt'), days: Number(sp.get('days')) || 0, sal: sp.get('sal') === '1', visa: sp.get('visa') === '1', unclear: sp.get('unclear') === '1' };
}

export const needsFull = p => !p.role && !!(p.q || p.loc || p.wt.length || p.days || p.sal || p.visa);

export function matcher(p) {
  const words = p.q.toLowerCase().split(/\s+/).filter(Boolean);
  const loc = p.loc.toLowerCase();
  const t = today();
  return j => (!words.length || words.every(w => j.hay.includes(w)))
    && (!p.role || j.r === p.role)
    && (!loc || j.place.includes(loc))
    && (!p.wt.length || p.wt.includes(j.wt))
    && (!p.days || t - j.pd <= p.days)
    && (!p.sal || !!j.sal)
    && (!p.visa || (j.f & 1) === 1);
}

// Loads every file a search needs, calling onProgress(jobsSoFar, done, total) as files arrive.
export async function collect(index, p, onProgress) {
  const key = p.from || 'all';
  const lists = [filesFor(index, key, p.role, needsFull(p))];
  if (p.from && p.unclear) lists.push(filesFor(index, 'unclear', p.role, needsFull(p)));
  const urls = lists.flat();
  const byId = new Map();
  let done = 0;
  // The newest-jobs file first, so something shows quickly; then the rest four at a time.
  const queue = [...urls];
  const worker = async () => {
    while (queue.length) {
      const u = queue.shift();
      for (const j of await decoded(u, index)) byId.set(j.id, j);
      done++;
      onProgress?.([...byId.values()], done, urls.length);
    }
  };
  if (!p.role && needsFull(p) && index.sets[key]?.split) {
    // Recent file first for a fast first paint.
    const first = `/s/${dirOf(key)}/recent.json`;
    for (const j of await decoded(first, index)) byId.set(j.id, j);
    onProgress?.([...byId.values()], 0, urls.length);
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return [...byId.values()];
}

export const countryName = (() => { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); const fix = { GB: 'United Kingdom', US: 'United States' }; return cc => fix[cc] ?? dn.of(cc); })();

export function guessCountry(index) {
  for (const l of navigator.languages || [navigator.language]) {
    const m = /-([A-Z]{2})$/i.exec(l || '');
    if (m && index.sets[m[1].toUpperCase()]) return m[1].toUpperCase();
  }
  return '';
}

// ---------- Search page ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function ago(d) {
  if (d <= 0) return 'today'; if (d === 1) return 'yesterday'; if (d < 31) return `${d} days ago`;
  const m = Math.round(d / 30.4); if (m < 12) return m === 1 ? 'a month ago' : `${m} months ago`;
  const y = Math.round(d / 365); return y === 1 ? 'a year ago' : `${y} years ago`;
}
const GLOBE = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M1.75 8h12.5M8 1.75c1.9 2 2.6 4 2.6 6.25S9.9 12.25 8 14.25C6.1 12.25 5.4 10.25 5.4 8S6.1 3.75 8 1.75z"/></svg>';

function card(j, checked) {
  const href = j.u; // our job page ("/job/...") or, when the job has no page, the employer's own posting
  const ext = !href.startsWith('/');
  return `<article class="card"><p class="strip">${checked} · posted ${ago(today() - j.pd)}</p><div class="card-in">
<h3 class="card-t"><a href="${esc(href)}"${ext ? ' rel="nofollow noopener" target="_blank"' : ''}>${esc(j.t)}</a></h3>
<p class="card-co">${esc(j.co)}</p><p class="card-where">${GLOBE}${esc(j.w)}</p>${j.sal ? `<p class="card-sal">${esc(j.sal)}</p>` : ''}${ext ? `<p class="card-ext">Opens on ${esc(j.co)}'s own site</p>` : ''}</div></article>`;
}

async function initSearch(form) {
  const results = document.querySelector('[data-results]');
  const status = document.querySelector('[data-status]');
  const moreBtn = document.querySelector('[data-more]');
  const unclearWrap = document.querySelector('[data-unclear-wrap]');
  let index;
  try { index = await loadIndex(); } catch { status.textContent = 'Search could not load. Please refresh the page.'; return; }
  const genDay = Math.floor(Date.parse(index.gen) / 86400000);
  const lag = today() - genDay;
  const checked = lag <= 0 ? 'Checked today' : lag === 1 ? 'Checked yesterday' : `Checked ${lag} days ago`;

  // Fill the form from the URL (or the browser's language for "I can apply from").
  const sp = new URLSearchParams(location.search);
  if (!sp.has('from') && ![...sp.keys()].length) { const g = guessCountry(index); if (g) sp.set('from', g); }
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') el.checked = sp.getAll(el.name).includes(el.value);
    else if (sp.has(el.name)) el.value = sp.get(el.name);
  }

  let shown = 0, matches = [], run = 0;
  const render = (reset) => {
    if (reset) { results.innerHTML = ''; shown = 0; }
    const next = matches.slice(shown, shown + PAGE);
    results.insertAdjacentHTML('beforeend', next.map(j => card(j, checked)).join(''));
    shown += next.length;
    moreBtn.hidden = shown >= matches.length;
  };

  async function update() {
    const my = ++run;
    const p = readParams(new URLSearchParams(new FormData(form)));
    unclearWrap.hidden = !p.from;
    const qs = new URLSearchParams(new FormData(form));
    for (const [k, v] of [...qs]) if (!v) qs.delete(k);
    history.replaceState(null, '', qs.toString() ? `?${qs}` : location.pathname);
    const n = [p.q, p.role, p.loc, p.days, p.sal, p.visa, p.unclear].filter(Boolean).length + p.wt.length + (p.from ? 1 : 0);
    document.querySelector('[data-filter-count]').textContent = n ? `(${n})` : '';
    const where = p.from ? ` you can apply for from ${countryName(p.from)}` : '';
    const m = matcher(p);
    status.textContent = 'Searching…';
    const t0 = performance.now();
    const all = await collect(index, p, (jobs, done, total) => {
      if (my !== run) return;
      matches = jobs.filter(m).sort((a, b) => b.pd - a.pd || b.fd - a.fd);
      render(true);
      if (total && done < total) status.textContent = `${matches.length.toLocaleString('en-GB')} jobs${where} so far · searching ${done} of ${total} groups…`;
    }).catch(() => null);
    if (my !== run) return;
    if (!all) { status.textContent = 'Some results could not load. Please try again.'; return; }
    matches = all.filter(m).sort((a, b) => b.pd - a.pd || b.fd - a.fd);
    render(true);
    window.__lastSearchMs = Math.round(performance.now() - t0);
    if (!matches.length) {
      const hint = p.wt.length ? 'removing the work-type filter' : p.loc ? 'clearing the place' : p.days ? 'widening the posted date' : p.q ? 'fewer or different keywords' : p.role ? 'any role' : 'another country';
      results.innerHTML = `<div class="empty"><p><strong>No jobs${where} match these filters.</strong></p><p>Try ${hint}.</p></div>`;
    }
    status.textContent = `${matches.length.toLocaleString('en-GB')} jobs${where}, newest first. ${checked}.`;
  }

  let timer;
  form.addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(update, e.target.type === 'search' || e.target.type === 'text' ? 200 : 0); });
  form.addEventListener('submit', e => { e.preventDefault(); update(); });
  moreBtn.addEventListener('click', () => render(false));

  // Phone: filters live in a bottom sheet.
  const openBtn = document.querySelector('[data-open-filters]');
  const close = () => { form.classList.remove('open'); document.body.classList.remove('sheet-open'); openBtn.focus(); };
  openBtn.addEventListener('click', () => { form.classList.add('open'); document.body.classList.add('sheet-open'); form.querySelector('input,select').focus(); });
  document.querySelector('[data-close-filters]').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && form.classList.contains('open')) close(); });

  // Save the search in this browser (PRD B3 flow 2). "New" later = first seen after this check.
  const msg = document.querySelector('[data-save-msg]');
  document.querySelector('[data-save]').addEventListener('click', () => {
    const qs = new URLSearchParams(location.search).toString();
    const p = readParams(new URLSearchParams(qs));
    const WT_WORDS = { onsite: 'on site', hybrid: 'hybrid', remote: 'remote' };
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const label = [p.q && `"${p.q}"`, index.roles.find(r => r[0] === p.role)?.[1], p.loc && cap(p.loc), p.wt.map(w => WT_WORDS[w]).join(' or '),
      p.from && `can apply from ${countryName(p.from)}`].filter(Boolean).join(', ') || 'All jobs';
    const saved = loadSaved().filter(s => s.qs !== qs);
    saved.unshift({ qs, label, seenDay: genDay });
    if (storeSaved(saved.slice(0, 10))) msg.textContent = 'Saved. Your home page will show how many new jobs match.';
    else msg.textContent = 'Could not save: this browser is blocking storage.';
  });

  update();
}

export function loadSaved() { try { return JSON.parse(localStorage.getItem('rs:saved') || '[]'); } catch { return []; } }
export function storeSaved(list) { try { localStorage.setItem('rs:saved', JSON.stringify(list)); return true; } catch { return false; } }

if (typeof document !== 'undefined') {
  const form = document.querySelector('[data-filters]');
  if (form) initSearch(form);
}
