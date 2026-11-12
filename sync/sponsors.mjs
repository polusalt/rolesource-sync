// Home Office Register of Licensed Sponsors (workers). GOV.UK, Open Government Licence v3.0.
// Used ONLY as a list of organisation names to probe in discovery (tools/discover.mjs). The sponsor-licence badge
// was dropped by the owner on 8 Nov 2026, so nothing here is shown to visitors.
import { fetchJson, politeFetch } from './http.mjs';
import { normName } from './text.mjs';

const CONTENT_API = 'https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers';
export const REGISTER_PAGE = 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers';

/** Minimal RFC 4180 CSV parser (quoted fields, doubled quotes, CRLF). */
export function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const LEGAL = /\b(limited|ltd|plc|llp|lp|llc|inc|incorporated|corporation|corp|company|co|gmbh|bv|sa|ag|uk|u k|the|group|holdings)\b/g;
export const coreName = s => normName(s).replace(LEGAL, ' ').replace(/\s+/g, ' ').trim();

/** Turn CSV rows into an index keyed by exact normalised organisation name. */
export function buildRegisterIndex(rows) {
  const [head, ...data] = rows;
  const col = n => head.findIndex(h => h.trim().toLowerCase() === n);
  const iName = col('organisation name'), iTown = col('town/city'), iCounty = col('county'), iRating = col('type & rating'), iRoute = col('route');
  const byName = new Map();
  for (const r of data) {
    const name = (r[iName] ?? '').trim();
    if (!name) continue;
    const key = normName(name);
    const e = byName.get(key) ?? { name, town: (r[iTown] ?? '').trim(), county: (r[iCounty] ?? '').trim(), ratings: new Set(), routes: new Set() };
    e.ratings.add((r[iRating] ?? '').trim()); e.routes.add((r[iRoute] ?? '').trim());
    byName.set(key, e);
  }
  return byName;
}

/** Download the current register. Returns { date, url, index } or null on failure. */
export async function downloadRegister() {
  const meta = await fetchJson(CONTENT_API);
  if (!meta.ok) return null;
  const att = (meta.json.details?.attachments ?? []).find(a => /\.csv$/i.test(a.url ?? ''));
  if (!att) return null;
  const csv = await politeFetch(att.url, { timeoutMs: 120000 });
  if (!csv.ok) return null;
  const m = att.url.match(/(\d{4}-\d{2}-\d{2})\.csv$/);
  const date = m ? m[1] : (meta.json.public_updated_at ?? '').slice(0, 10);
  return { date, url: att.url, index: buildRegisterIndex(parseCsv(csv.body)) };
}
