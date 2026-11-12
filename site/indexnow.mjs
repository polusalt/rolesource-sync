// After a deploy: compare today's job URLs with yesterday's and tell IndexNow (Bing and others) which
// were added or removed (PRD B7, RULES BING-3/J3). Free service, no account.
//   node site/indexnow.mjs [--dry]
// Keeps data/published-urls.json (carried to tomorrow in the Actions cache). Pings only once the site
// is launched (config.launched) and has a real address.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(path.join(root, 'config.json'), 'utf8'));
const siteUrl = (process.env.SITE_URL ?? config.siteUrl ?? '').replace(/\/$/, '');
const dry = process.argv.includes('--dry');

export function changedUrls(before, after) {
  const a = new Set(after), b = new Set(before);
  return { added: after.filter(u => !b.has(u)), removed: before.filter(u => !a.has(u)) };
}

function jobUrlsInSitemaps() {
  const dist = path.join(root, 'dist');
  const index = readFileSync(path.join(dist, 'sitemap-index.xml'), 'utf8');
  const urls = [];
  for (const m of index.matchAll(/<loc>[^<]*?\/(sitemaps\/jobs-\d+\.xml)<\/loc>/g)) {
    for (const u of readFileSync(path.join(dist, m[1]), 'utf8').matchAll(/<loc>[^<]*?:\/\/[^/]+(\/[^<]*)<\/loc>/g)) urls.push(u[1]);
  }
  return urls;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.join(root, 'data', 'published-urls.json');
  const before = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  const after = jobUrlsInSitemaps();
  const { added, removed } = changedUrls(before, after);
  console.log(`Job URLs: ${after.length} today, ${added.length} added, ${removed.length} removed.`);
  const ready = config.launched && /^https:\/\//.test(siteUrl);
  if (!ready || dry) console.log(ready ? 'Dry run: not pinging IndexNow.' : 'Not launched yet (or no site address): not pinging IndexNow.');
  else {
    const host = new URL(siteUrl).host;
    const list = [...added, ...removed].map(u => siteUrl + u);
    for (let i = 0; i < list.length; i += 10000) {
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', 'user-agent': config.userAgent },
        body: JSON.stringify({ host, key: config.indexNowKey, keyLocation: `${siteUrl}/${config.indexNowKey}.txt`, urlList: list.slice(i, i + 10000) }),
      });
      console.log(`IndexNow batch ${i / 10000 + 1}: HTTP ${res.status}`);
      if (res.status >= 400 && res.status !== 429) process.exitCode = 1;
    }
  }
  // Only remember today's list once a ping has been sent (or wasn't due), so nothing is skipped.
  if (!process.exitCode) writeFileSync(file, JSON.stringify(after));
}
