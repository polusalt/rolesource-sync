// Daily Apply-link spot check (PRD B9 "Apply-link check on 50 random jobs"; RULES J4).
// Opens the employer's apply URL for 50 random job pages, politely, and reports any that don't load.
// The full daily feed read already removes closed jobs; this catches apply links that break while
// the job is still in the feed.   node site/apply-check.mjs [count]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { politeFetch } from '../sync/http.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const n = Number(process.argv[2] ?? 50);
const dataDir = path.join(root, process.argv[3] ?? 'data'); // optional data folder, e.g. data/sample
const { jobs } = JSON.parse(readFileSync(path.join(dataDir, 'jobs.json'), 'utf8'));

// Seeded by the date, so a re-run on the same day checks the same jobs.
let seed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const picked = [];
const pool = [...jobs];
while (picked.length < Math.min(n, pool.length)) picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);

const results = [];
for (const j of picked) {
  let status = 0;
  try { status = (await politeFetch(j.applyUrl, { timeoutMs: 20000 })).status; } catch { status = 0; }
  results.push({ id: j.id, employer: j.employer, url: j.applyUrl, status });
}
const bad = results.filter(r => r.status === 404 || r.status === 410 || r.status === 0);
const report = { checkedAt: new Date().toISOString(), checked: results.length, ok: results.filter(r => r.status >= 200 && r.status < 400).length, broken: bad };
writeFileSync(path.join(dataDir, 'apply-check.json'), JSON.stringify(report, null, 1));
console.log(`Apply links: ${report.ok} of ${report.checked} load; ${bad.length} broken or unreachable.`);
for (const b of bad) console.log(`  ${b.status || 'no answer'}  ${b.employer}  ${b.url}`);
