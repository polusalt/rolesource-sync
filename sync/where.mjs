// Where a job is and who can apply, for any country. The product's main USP ("I can apply from ...").
// Fails closed: a remote job whose reach can't be read is "unclear" and is only shown when the visitor asks.
//
// whereCanApply(job) -> {
//   workType: 'onsite' | 'hybrid' | 'remote',
//   located: ['GB', ...]          countries the job is in (on-site/hybrid), or the remote job's listed countries
//   cities: [{country, city}],
//   remote: null | { worldwide, countries: [...], regions: [...], excluded: [...], unclear },
//   reason: string
// }
// openTo(where, 'ZA') -> can someone living in that country apply?
import { readLocation, locationCountries } from './places.mjs';
import { regionIncludes, EU27 } from './regions.mjs';

// A place phrase: up to the end of the clause.
const PLACE = String.raw`([^.;:\n!?]{2,80})`;
const REFUSES = /\b(?:(?:are|is)\s+not|aren['’]t|isn['’]t|unable|not)\s+(?:able\s+to\s+|currently\s+)?(?:hire|hiring|employ|consider|accept)|\b(?:cannot|can['’]t|can\s+not|won['’]t|do\s+not|don['’]t)\s+(?:currently\s+)?(?:hire|employ|consider|accept|sponsor\s+or\s+hire)/i;
const ALLOW = [
  // "must reside in the United States", "need to be based in Canada"
  new RegExp(String.raw`\b(?:must|need\s+to|needs\s+to|required\s+to|should|will\s+need\s+to)\s+(?:be\s+)?(?:currently\s+)?(?:reside|residing|live|living|located|based|resident)\s+(?:in|within)\s+${PLACE}`, 'gi'),
  // "authorized to work in the US", "right to work in the UK"
  new RegExp(String.raw`\b(?:authori[sz]ed|eligible|legally\s+(?:able|permitted)|permitted)\s+to\s+work\s+in\s+${PLACE}`, 'gi'),
  new RegExp(String.raw`\bright\s+to\s+work\s+in\s+${PLACE}`, 'gi'),
  // "open to candidates based in the US and Europe"
  new RegExp(String.raw`\b(?:open|available)\s+(?:only\s+)?to\s+(?:candidates|applicants|people|residents|talent)\s+(?:who\s+are\s+)?(?:based\s+|located\s+|residing\s+|living\s+)?(?:in|across|within|from)\s+${PLACE}`, 'gi'),
  // "remote within the UK", "fully remote in Canada", "remote across Europe"
  // (not "a remote-first company across the US and Europe": that describes the company, not the job)
  new RegExp(String.raw`\b(?:remote|work\s+from\s+home|home[\s-]based|fully\s+remote)\b(?![\s-]first)(?:(?!company|team|business|organi[sz]ation|employees)[^.\n]){0,25}?\b(?:in|within|across|from|anywhere\s+in)\s+${PLACE}`, 'gi'),
  new RegExp(String.raw`\banywhere\s+(?:in|within|across)\s+${PLACE}`, 'gi'),
  // "candidates ... based in Germany"
  new RegExp(String.raw`\b(?:you|candidates?|applicants?|you're|you\s+are)\b[^.\n]{0,60}?\b(?:based|located|reside|residing|living|live)\s+(?:in|within|anywhere\s+in)\s+${PLACE}`, 'gi'),
];
// "US-only", "UK only", "Canada-based only"
const ONLY = /\b(US|U\.S\.|USA|United\s+States|UK|U\.K\.|United\s+Kingdom|Canada|Germany|India|Australia|Ireland|Spain|France|Netherlands|Poland|Brazil|Mexico)[\s-]+(?:only|based\s+only|residents\s+only)\b/gi;
const US_STATES_LIST = /\b(?:following|these|select|approved)\s+(?:US\s+)?states\b|\bwe\s+(?:are\s+)?(?:only\s+)?(?:able\s+to\s+)?hire\s+in\s+(?:the\s+following|these)\b/i;
const EU_ONLY = [
  /\b(?:based|located|reside|residing|live|living|resident)\s+(?:in|within)\s+(?:an?\s+)?(?:the\s+)?(?:EU|European\s+Union)(?:\s+(?:member\s+state|country))?\b/i,
  /\bEU\s+(?:work(?:ing)?\s+)?(?:permit|authori[sz]ation|visa|citizen(?:ship)?)\b/i,
  /\bright\s+to\s+work\s+in\s+(?:the\s+)?(?:EU|European\s+Union)\b/i,
];
// "across EMEA excluding the UK". Not "outside of the UK" (usually a perk: "work from outside of the UK for 6 months").
const EXCLUDING = /\b(?:excluding|except(?:\s+for)?|not\s+including|other\s+than)\s+([^.;:\n)]{2,60})/gi;
const US_TIMEZONE = /\b(?:EST|EDT|PST|PDT|CST|MST|Eastern|Pacific|Central)\s+(?:time\s*zone|hours|business\s+hours|timezone)\b/i;
const HYBRID_TEXT = /\bhybrid\b|flexibility\s+to\s+work\s+from\s+home|\b(?:one|two|three|four|[1-4])\s+days?\s+(?:a|per|each)\s+week\s+(?:in|at|from)\s+(?:the|our)\s+(?:office|hub)|\bin\s+(?:the\s+)?office\s+(?:one|two|three|four|[1-4])\s+days/i;
const NOT_FULLY_REMOTE = /\b(?:isn't|is\s+not|not)\s+(?:a\s+fit|suitable)\s+for\s+fully\s+remote|\bnot\s+a\s+fully\s+remote\s+(?:role|position)|\boffice[\s-]based\s+\d(?:\s*[–-]\s*\d)?\s+days/i;
const BASED_IN = [
  /\b(?:[Tt]his|[Tt]he)\s+(?:role|position|job|opportunity)\s+(?:is|will\s+be)\s+based\s+(?:in|out\s+of)\s+([A-Z][^.;\n]{1,140})/,
  /\b(?:[Ll]ooking\s+for|[Ss]eeking|[Hh]iring)\s+an?\s+[^.;\n]{2,70}?\s+based\s+in\s+([A-Z][^.;,\n]{1,30})/,
];
const NON_EUROPE_REGIONS = new Set(['americas', 'north-america', 'latam', 'apac', 'asia', 'anz', 'africa', 'mena']);

/** Countries and regions named in a captured place phrase. Empty when it names neither. */
function placeScope(text) {
  const loc = readLocation(text);
  const countries = locationCountries(loc);
  const regions = new Set([...loc.regions].filter(r => r !== 'world'));
  return { countries, regions, world: loc.regions.has('world'), remote: loc.remote };
}

/** What the advert's own wording says about where applicants may be. */
// Abbreviations with full stops would end a place phrase early ("the U.S. without ...").
const tidy = t => String(t).replace(/\bU\.S\.(?:A\.)?/g, 'USA').replace(/\bU\.K\./g, 'UK').replace(/\bE\.U\./g, 'EU');

export function textScope(text = '') {
  text = tidy(text);
  const countries = new Set(), regions = new Set(), excluded = new Set();
  for (const re of ALLOW) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      // "If you are based in another location within EMEA, we aren't able to hire in your location": a refusal,
      // not an opening (sample where-sample-1 #54, 12 Nov 2026). Skip phrases whose sentence refuses to hire.
      const end = text.slice(m.index).search(/[.!?\n]/);
      const sentence = text.slice(m.index, end < 0 ? undefined : m.index + end);
      if (REFUSES.test(sentence)) continue;
      const p = placeScope(m[1]);
      p.countries.forEach(c => countries.add(c)); p.regions.forEach(r => regions.add(r));
    }
  }
  ONLY.lastIndex = 0;
  for (const m of text.matchAll(ONLY)) placeScope(m[1]).countries.forEach(c => countries.add(c));
  if (US_STATES_LIST.test(text)) countries.add('US');
  const euOnly = EU_ONLY.some(re => re.test(text));
  if (euOnly) regions.add('eu');
  EXCLUDING.lastIndex = 0;
  for (const m of text.matchAll(EXCLUDING)) placeScope(m[1]).countries.forEach(c => excluded.add(c));
  return { countries, regions, excluded, euOnly, usHours: US_TIMEZONE.test(text) };
}

/** The advert places the job in named countries ("This role is based in Stockholm"). */
function basedIn(text) {
  for (const re of BASED_IN) {
    const m = text.match(re);
    if (!m) continue;
    const p = placeScope(m[1]);
    if (p.countries.size && !p.regions.size && !p.world && !p.remote) return { countries: p.countries, phrase: m[1].trim().slice(0, 40) };
  }
  return null;
}

export function whereCanApply(job) {
  const locs = (job.locations ?? []).map(readLocation);
  const titleLoc = readLocation(job.title ?? '');
  const text = tidy(job.descriptionText ?? '');
  const codes = (job.countryCodes ?? []).map(c => (c.toUpperCase() === 'UK' ? 'GB' : c.toUpperCase()));

  let located = new Set([...locs.flatMap(l => [...locationCountries(l)]), ...codes, ...locationCountries(titleLoc)]);
  const cities = [];
  for (const l of [...locs, titleLoc]) for (const c of l.cities) if (!cities.some(x => x.city === c.city && x.country === c.country)) cities.push(c);
  const locRegions = new Set(locs.flatMap(l => [...l.regions]));
  const titleRegions = new Set([...titleLoc.regions].filter(r => NON_EUROPE_REGIONS.has(r)));

  let remote = job.workplace === 'remote' || (job.workplace == null && (locs.some(l => l.remote) || titleLoc.remote));
  const hybridWords = /\bhybrid\b/i.test([...(job.locations ?? []), job.title].join(' '));
  let hybrid = job.workplace === 'hybrid' || (job.workplace == null && (hybridWords || HYBRID_TEXT.test(text)));
  if (remote && NOT_FULLY_REMOTE.test(text) && located.size) { remote = false; hybrid = true; }
  const workType = remote ? 'remote' : hybrid ? 'hybrid' : 'onsite';

  // The advert's "based in" beats the location field when they differ.
  const b = basedIn(text);
  let reason = '';
  if (b) {
    const both = [...b.countries].filter(c => located.has(c));
    const next = new Set(both.length ? both : b.countries);
    if ([...located].some(c => !next.has(c)) || !located.size) { located = next; reason = `advert: based in ${b.phrase}`; }
  }
  const keepCities = cs => cs.filter(c => located.has(c.country));

  if (!remote) {
    return { workType, located: [...located], cities: keepCities(cities), remote: null, reason: reason || (located.size ? 'location' : 'no location') };
  }

  const t = textScope(text);
  const scope = { worldwide: false, countries: new Set(), regions: new Set(), excluded: t.excluded, unclear: false };
  const addText = () => { t.countries.forEach(c => scope.countries.add(c)); t.regions.forEach(r => scope.regions.add(r)); };

  if (reason) {                                   // based in X: remote, but only in those countries
    located.forEach(c => scope.countries.add(c));
  } else if (located.size) {                      // "Remote - Germany", "Remote (UK)", country codes
    // Regions in the location field count too ("NAMER / EMEA", "North America / Europe").
    located.forEach(c => scope.countries.add(c)); locRegions.forEach(r => r !== 'world' && scope.regions.add(r)); addText(); reason = 'remote in listed countries';
  } else if (titleRegions.size) {                 // "... (Americas)", "AMER"
    titleRegions.forEach(r => scope.regions.add(r)); reason = 'title names a region';
  } else if (locRegions.has('world')) {
    if (t.countries.size || t.regions.size) { addText(); reason = 'worldwide label, advert names countries'; }
    else if (t.usHours) { scope.unclear = true; reason = 'worldwide but US hours'; }
    else { scope.worldwide = true; reason = 'remote anywhere'; }
  } else if (locRegions.size) {
    locRegions.forEach(r => scope.regions.add(r)); addText(); reason = 'remote in listed regions';
  } else if (t.countries.size || t.regions.size) {
    addText(); reason = 'advert names where applicants may be';
  } else {
    scope.unclear = true; reason = 'remote, no country stated';
  }
  // EU-only wording narrows Europe to the EU.
  if (t.euOnly && scope.regions.has('europe')) { scope.regions.delete('europe'); scope.regions.add('eu'); }
  if (t.euOnly && scope.regions.has('emea')) { scope.regions.delete('emea'); scope.regions.add('eu'); }

  return {
    workType, located: [...located], cities: keepCities(cities),
    remote: { worldwide: scope.worldwide, countries: [...scope.countries], regions: [...scope.regions], excluded: [...scope.excluded], unclear: scope.unclear },
    reason,
  };
}

/** Can someone living in country cc apply? Unclear remote jobs answer false (shown only on request). */
export function openTo(w, cc) {
  if (!w.remote) return w.located.includes(cc);
  const r = w.remote;
  if (r.excluded.includes(cc)) return false;
  if (r.unclear) return false;
  return r.worldwide || r.countries.includes(cc) || r.regions.some(g => regionIncludes(g, cc));
}

export { EU27 };
