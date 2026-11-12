// Polite HTTP: identifies the crawler, limits concurrency per host, retries once on network errors and 429/5xx.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(here, '..', 'config.json'), 'utf8'));

export const USER_AGENT = config.userAgent;
const perHost = config.maxConcurrentPerHost ?? 4;
const active = new Map(); // host -> count
const queues = new Map(); // host -> [resolve]

async function acquire(host) {
  const n = active.get(host) ?? 0;
  if (n < perHost) { active.set(host, n + 1); return; }
  await new Promise(res => { if (!queues.has(host)) queues.set(host, []); queues.get(host).push(res); });
  active.set(host, (active.get(host) ?? 0) + 1);
}
function release(host) {
  active.set(host, (active.get(host) ?? 1) - 1);
  const q = queues.get(host);
  if (q && q.length) q.shift()();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Fetch a URL politely. Returns { ok, status, body } where body is text. Never throws. */
export async function politeFetch(url, { timeoutMs = 30000 } = {}) {
  const host = new URL(url).host;
  await acquire(host);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, application/xml, text/xml' }, signal: ctrl.signal });
        clearTimeout(t);
        if ((r.status === 429 || r.status >= 500) && attempt === 0) { await sleep(2000); continue; }
        return { ok: r.ok, status: r.status, body: r.ok ? await r.text() : '' };
      } catch (e) {
        if (attempt === 0) { await sleep(1000); continue; }
        return { ok: false, status: 0, body: '', error: String(e?.message ?? e) };
      }
    }
    return { ok: false, status: 0, body: '' };
  } finally {
    release(host);
  }
}

export async function fetchJson(url, opts) {
  const r = await politeFetch(url, opts);
  if (!r.ok) return { ...r, json: null };
  try { return { ...r, json: JSON.parse(r.body) }; } catch { return { ...r, ok: false, json: null, error: 'bad json' }; }
}
