// Daily sync. `node sync/run.mjs --dry` = first N employers, output to data/dry/. Without --dry = all, output to data/.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as greenhouse from './ats/greenhouse.mjs';
import * as lever from './ats/lever.mjs';
import * as ashby from './ats/ashby.mjs';
import * as smartrecruiters from './ats/smartrecruiters.mjs';
import * as recruitee from './ats/recruitee.mjs';
import * as personio from './ats/personio.mjs';
import { cleanHtml, htmlToText, normName, slugify } from './text.mjs';
import { whereCanApply } from './where.mjs';
import { isEnglish } from './lang.mjs';
import { resolveSalary } from './salary.mjs';
import { roleFamily, seniority, advertSponsorship, agencySignal } from './classify.mjs';
import { coreName } from './sponsors.mjs';
import { dedupe } from './dedupe.mjs';
import { updateState, keepFailedBoard } from './state.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };
const ADAPTERS = { greenhouse, lever, ashby, smartrecruiters, recruitee, personio };

// --sample N: a seeded random N employers, output to data/sample/ (to measure time and size without a full run).
const argAt = process.argv.indexOf('--sample');
const sampleN = argAt > 0 ? +process.argv[argAt + 1] : 0;
const dry = process.argv.includes('--dry') || sampleN > 0;
const config = readJson(path.join(root, 'config.json'), {});
const outDir = path.join(root, 'data', sampleN ? 'sample' : dry ? 'dry' : '');
mkdirSync(path.join(outDir, 'cache'), { recursive: true });

const now = new Date();
const nowIso = now.toISOString();
const DAY = 86400000;

export const jobId = (ats, board, id) => createHash('sha1').update(`${ats}:${board}:${id}`).digest('base64url').replace(/[-_]/g, '').slice(0, 10).toLowerCase();

async function main() {
  const t0 = Date.now();
  let employers = readJson(path.join(root, 'data', 'employers.json'), { employers: [] }).employers;
  if (sampleN) {
    let s = 7; const a = [...employers];
    for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    employers = a.slice(0, sampleN);
  } else if (dry) employers = employers.slice(0, config.dryRunEmployers ?? 50);
  const blocked = new Set(readJson(path.join(root, 'data', 'blocklist.json'), { employers: [] }).employers.map(e => coreName(e.name ?? e)));
  const prevJobs = readJson(path.join(outDir, 'jobs.json'), { jobs: [] }).jobs;
  const prevShards = {};
  const prevAdvert = id => {
    const k = createHash('md5').update(id).digest('hex').slice(0, 2);
    prevShards[k] ??= readJson(path.join(outDir, 'adverts', `${k}.json`), {});
    return prevShards[k][id] ?? '';
  };
  const state = readJson(path.join(outDir, 'state.json'), { jobs: {}, boards: {} });
  const srCache = readJson(path.join(outDir, 'cache', 'smartrecruiters.json'), {});

  const report = { startedAt: nowIso, dry, employers: employers.length, boardsOk: 0, boardsFailed: [], fetched: 0, kept: 0,
    notEnglish: 0, workType: {}, remoteScope: { worldwide: 0, listed: 0, unclear: 0 }, noLocation: 0, countries: {},
    salaryShown: 0, advertSponsorship: { yes: 0, no: 0 }, agencyFlags: [], blockedJobs: 0, duplicatesRemoved: 0, closed: 0, perEmployer: {} };

  const live = [];
  const queue = [...employers];
  async function worker() {
    for (let emp; (emp = queue.shift());) {
      const adapter = ADAPTERS[emp.ats];
      const key = `${emp.ats}:${emp.board}`;
      if (!adapter) { report.boardsFailed.push({ key, status: 'unknown ats' }); continue; }
      const res = await adapter.fetchBoard(emp, { detailCache: srCache });
      if (!res.ok) {
        const firstFail = state.boards[key]?.failingSince ?? nowIso;
        state.boards[key] = { ...state.boards[key], failingSince: firstFail, lastStatus: res.status };
        report.boardsFailed.push({ key, status: res.status, since: firstFail });
        if (keepFailedBoard(firstFail, nowIso, config.keepFailedBoardDays ?? 2)) {
          // Adverts for these jobs are still in yesterday's shards; carried over below.
          live.push(...prevJobs.filter(j => `${j.ats}:${j.board}` === key).map(j => ({ ...j, stale: true, descriptionHtml: prevAdvert(j.id) })));
        }
        continue;
      }
      state.boards[key] = { lastOk: nowIso, lastStatus: res.status };
      report.boardsOk++;
      report.fetched += res.jobs.length;
      let keptHere = 0;
      for (const raw of res.jobs) {
        const descriptionText = htmlToText(raw.descriptionHtml);
        const job = { ...raw, descriptionText };
        if (!isEnglish(descriptionText)) { report.notEnglish++; continue; }
        if (blocked.has(coreName(raw.employer))) { report.blockedJobs++; continue; }
        const w = whereCanApply(job);
        const agency = agencySignal(raw.employer, descriptionText);
        if (agency) report.agencyFlags.push({ employer: raw.employer, title: raw.title, signal: agency, url: raw.jobUrl });
        const salary = resolveSalary(job, w.located);
        const id = jobId(raw.ats, raw.board, raw.jobId);
        live.push({
          id, slug: slugify(`${raw.title} ${raw.employer}`), title: raw.title.trim(), employer: raw.employer, employerSlug: slugify(emp.name),
          ats: raw.ats, board: raw.board, atsJobId: raw.jobId, jobUrl: raw.jobUrl, applyUrl: raw.applyUrl,
          locations: raw.locations, located: w.located, cities: w.cities, remote: w.remote, whereReason: w.reason,
          workType: w.workType, salary, role: roleFamily(raw.title), seniority: seniority(raw.title, raw.experienceLevel),
          department: raw.department, employmentType: raw.employmentType,
          advertSponsorship: advertSponsorship(descriptionText), agencySignal: agency,
          postedAt: raw.postedAt, descriptionHtml: cleanHtml(raw.descriptionHtml),
        });
        keptHere++;
      }
      report.perEmployer[key] = { fetched: res.jobs.length, kept: keptHere };
    }
  }
  // Boards fetched at once overall; http.mjs still caps each ATS host at maxConcurrentPerHost (4), so 24 = 6 hosts x 4.
  await Promise.all(Array.from({ length: config.syncWorkers ?? 24 }, worker));

  const { jobs, removed, massMerged } = dedupe(live);
  report.duplicatesRemoved = removed;
  report.massPostedMerged = massMerged;

  // State: first seen, last checked, closed. Jobs kept from a failed board keep their old "last checked".
  const closed = updateState(state, jobs, nowIso);
  for (const j of jobs) {
    if (j.salary) report.salaryShown++;
    report.workType[j.workType] = (report.workType[j.workType] ?? 0) + 1;
    if (j.remote) report.remoteScope[j.remote.worldwide ? 'worldwide' : j.remote.unclear ? 'unclear' : 'listed']++;
    if (!j.located.length && !j.remote) report.noLocation++;
    for (const c of j.located) report.countries[c] = (report.countries[c] ?? 0) + 1;
    if (j.advertSponsorship) report.advertSponsorship[j.advertSponsorship]++;
  }
  report.closed = closed.length;
  report.staleKept = jobs.filter(j => j.stale).length;
  report.kept = jobs.length;
  report.seconds = Math.round((Date.now() - t0) / 1000);

  // Light index for search and browse pages; full adverts go in 256 shards (by id prefix) so a job page
  // build reads one small file and an unchanged shard doesn't churn.
  const shards = {};
  const index = jobs.map(({ descriptionHtml, ...rest }) => {
    const k = createHash('md5').update(rest.id).digest('hex').slice(0, 2);
    (shards[k] ??= {})[rest.id] = descriptionHtml;
    return rest;
  });
  mkdirSync(path.join(outDir, 'adverts'), { recursive: true });
  for (const [k, v] of Object.entries(shards)) writeFileSync(path.join(outDir, 'adverts', `${k}.json`), JSON.stringify(v));
  for (let i = 0; i < 256; i++) { const k = i.toString(16).padStart(2, '0'); if (!shards[k] && existsSync(path.join(outDir, 'adverts', `${k}.json`))) writeFileSync(path.join(outDir, 'adverts', `${k}.json`), '{}'); }
  writeFileSync(path.join(outDir, 'jobs.json'), JSON.stringify({ generatedAt: nowIso, jobs: index }));
  writeFileSync(path.join(outDir, 'state.json'), JSON.stringify(state));
  writeFileSync(path.join(outDir, 'closed.json'), JSON.stringify({ at: nowIso, ids: closed }));
  writeFileSync(path.join(outDir, 'cache', 'smartrecruiters.json'), JSON.stringify(srCache));
  writeFileSync(path.join(outDir, 'sync-report.json'), JSON.stringify(report, null, 1));

  console.log(`Sync ${dry ? '(dry run) ' : ''}done in ${report.seconds}s: ${report.boardsOk}/${employers.length} boards ok, ${report.fetched} jobs fetched, ${report.kept} kept, ${report.closed} closed since last run.`);
  const top = Object.entries(report.countries).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c, n]) => `${c} ${n}`).join(', ');
  console.log(`Work type: ${JSON.stringify(report.workType)}. Remote reach: ${JSON.stringify(report.remoteScope)}. Not English: ${report.notEnglish}. No location: ${report.noLocation}.`);
  console.log(`Top countries: ${top}`);
  console.log(`Salary shown: ${report.salaryShown}. Advert visa wording: ${JSON.stringify(report.advertSponsorship)}. Agency flags: ${report.agencyFlags.length}. Blocked: ${report.blockedJobs}. Duplicates removed: ${removed}.`);
  if (report.boardsFailed.length) console.log('Failed boards:', report.boardsFailed.map(b => `${b.key} (${b.status})`).join(', '));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(e => { console.error(e); process.exit(1); });
}
