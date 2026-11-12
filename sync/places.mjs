// Place detection used by the eligibility rules. Lists are deliberately explicit so they can be checked by eye.
import { normName } from './text.mjs';

export const UK_CITIES = [
  'london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'edinburgh', 'bristol', 'liverpool', 'sheffield', 'newcastle',
  'newcastle upon tyne', 'nottingham', 'leicester', 'cardiff', 'belfast', 'cambridge', 'oxford', 'brighton', 'reading',
  'milton keynes', 'southampton', 'portsmouth', 'york', 'bath', 'aberdeen', 'dundee', 'swansea', 'coventry', 'derby',
  'exeter', 'plymouth', 'norwich', 'ipswich', 'chelmsford', 'colchester', 'guildford', 'woking', 'slough', 'watford',
  'st albans', 'luton', 'bedford', 'northampton', 'peterborough', 'stoke', 'stoke on trent', 'wolverhampton', 'bolton',
  'stockport', 'salford', 'warrington', 'chester', 'preston', 'blackpool', 'lancaster', 'hull', 'kingston upon hull',
  'bradford', 'huddersfield', 'wakefield', 'harrogate', 'durham', 'sunderland', 'middlesbrough', 'gateshead', 'carlisle',
  'inverness', 'stirling', 'perth', 'livingston', 'paisley', 'newport', 'wrexham', 'bangor', 'derry', 'londonderry',
  'lisburn', 'gloucester', 'cheltenham', 'swindon', 'basingstoke', 'farnborough', 'crawley', 'maidstone', 'canterbury',
  'chatham', 'tunbridge wells', 'sevenoaks', 'croydon', 'kingston', 'richmond', 'uxbridge', 'harrow', 'stevenage',
  'hemel hempstead', 'high wycombe', 'aylesbury', 'bournemouth', 'poole', 'worcester', 'hereford', 'shrewsbury',
  'telford', 'lincoln', 'leamington spa', 'warwick', 'solihull', 'redditch', 'loughborough', 'macclesfield', 'crewe',
  'canary wharf', 'city of london', 'greater london', 'west midlands', 'east midlands', 'yorkshire', 'north yorkshire',
  'west yorkshire', 'south yorkshire', 'kent', 'surrey', 'essex', 'sussex', 'west sussex', 'east sussex', 'hampshire',
  'berkshire', 'hertfordshire', 'buckinghamshire', 'oxfordshire', 'cambridgeshire', 'lancashire', 'cheshire',
  'merseyside', 'greater manchester', 'tyne and wear', 'devon', 'cornwall', 'somerset', 'dorset', 'wiltshire',
  'gloucestershire', 'norfolk', 'suffolk', 'lincolnshire', 'nottinghamshire', 'derbyshire', 'leicestershire',
  'staffordshire', 'warwickshire', 'northamptonshire', 'bedfordshire', 'midlothian', 'fife', 'lanarkshire',
];
// Cities that also exist elsewhere: only count as UK when no other country is named.
export const AMBIGUOUS_UK = new Set(['london', 'cambridge', 'birmingham', 'manchester', 'richmond', 'kingston', 'perth', 'newport', 'bangor', 'durham', 'york', 'reading', 'bedford', 'lancaster', 'warwick', 'derby', 'chester', 'plymouth', 'salford', 'hull', 'kent', 'essex', 'portsmouth', 'oxford', 'bristol', 'exeter', 'gloucester', 'lincoln', 'norwich', 'worcester', 'stirling', 'livingston', 'paisley', 'swindon', 'canterbury', 'aberdeen', 'dorset', 'surrey', 'sussex', 'devon', 'cornwall', 'somerset', 'suffolk', 'norfolk']);

export const UK_WORDS = ['uk', 'u k', 'united kingdom', 'great britain', 'britain', 'england', 'scotland', 'wales', 'northern ireland', 'gb', 'gbr'];

export const US_STATES = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado', CT: 'connecticut', DE: 'delaware',
  FL: 'florida', GA: 'georgia', HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas', KY: 'kentucky',
  LA: 'louisiana', ME: 'maine', MD: 'maryland', MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi',
  MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey', NM: 'new mexico',
  NY: 'new york', NC: 'north carolina', ND: 'north dakota', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania',
  RI: 'rhode island', SC: 'south carolina', SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont',
  VA: 'virginia', WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming', DC: 'district of columbia',
};
export const US_CITIES = ['new york city', 'nyc', 'san francisco', 'sf', 'los angeles', 'seattle', 'boston', 'chicago', 'austin', 'denver', 'atlanta', 'miami', 'dallas', 'houston', 'phoenix', 'philadelphia', 'san diego', 'san jose', 'palo alto', 'mountain view', 'menlo park', 'sunnyvale', 'redwood city', 'washington dc', 'bay area', 'silicon valley', 'brooklyn', 'pittsburgh', 'raleigh', 'salt lake city', 'portland', 'minneapolis', 'detroit', 'nashville', 'charlotte'];

// Country names (lower case) -> ISO code. Non-exhaustive but covers what ATS feeds use most.
export const COUNTRIES = {
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB', 'northern ireland': 'GB',
  'united states': 'US', 'united states of america': 'US', 'usa': 'US', 'us': 'US', 'u s': 'US', 'america': 'US',
  'canada': 'CA', 'ireland': 'IE', 'germany': 'DE', 'france': 'FR', 'spain': 'ES', 'portugal': 'PT', 'italy': 'IT', 'netherlands': 'NL',
  'the netherlands': 'NL', 'belgium': 'BE', 'luxembourg': 'LU', 'switzerland': 'CH', 'austria': 'AT', 'poland': 'PL', 'czech republic': 'CZ',
  'czechia': 'CZ', 'romania': 'RO', 'bulgaria': 'BG', 'hungary': 'HU', 'greece': 'GR', 'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK',
  'finland': 'FI', 'estonia': 'EE', 'latvia': 'LV', 'lithuania': 'LT', 'croatia': 'HR', 'serbia': 'RS', 'slovakia': 'SK', 'slovenia': 'SI',
  'ukraine': 'UA', 'turkey': 'TR', 'turkiye': 'TR', 'israel': 'IL', 'united arab emirates': 'AE', 'uae': 'AE', 'saudi arabia': 'SA',
  'india': 'IN', 'pakistan': 'PK', 'bangladesh': 'BD', 'sri lanka': 'LK', 'singapore': 'SG', 'malaysia': 'MY', 'indonesia': 'ID',
  'philippines': 'PH', 'vietnam': 'VN', 'thailand': 'TH', 'japan': 'JP', 'south korea': 'KR', 'korea': 'KR', 'china': 'CN',
  'hong kong': 'HK', 'taiwan': 'TW', 'australia': 'AU', 'new zealand': 'NZ', 'brazil': 'BR', 'mexico': 'MX', 'argentina': 'AR',
  'colombia': 'CO', 'chile': 'CL', 'peru': 'PE', 'uruguay': 'UY', 'costa rica': 'CR', 'south africa': 'ZA', 'nigeria': 'NG',
  'kenya': 'KE', 'egypt': 'EG', 'morocco': 'MA', 'ghana': 'GH', 'cyprus': 'CY', 'malta': 'MT', 'iceland': 'IS',
};
const COUNTRY_CITIES = {
  dublin: 'IE', cork: 'IE', galway: 'IE', berlin: 'DE', munich: 'DE', hamburg: 'DE', frankfurt: 'DE', cologne: 'DE', paris: 'FR', lyon: 'FR',
  madrid: 'ES', barcelona: 'ES', valencia: 'ES', lisbon: 'PT', porto: 'PT', amsterdam: 'NL', rotterdam: 'NL', 'the hague': 'NL', utrecht: 'NL',
  brussels: 'BE', zurich: 'CH', geneva: 'CH', vienna: 'AT', warsaw: 'PL', krakow: 'PL', wroclaw: 'PL', prague: 'CZ', bucharest: 'RO',
  budapest: 'HU', athens: 'GR', stockholm: 'SE', oslo: 'NO', copenhagen: 'DK', helsinki: 'FI', tallinn: 'EE', milan: 'IT', rome: 'IT',
  stockholm: 'SE', gothenburg: 'SE', malmo: 'SE', aarhus: 'DK', antwerp: 'BE', ghent: 'BE', eindhoven: 'NL', seville: 'ES', malaga: 'ES', bilbao: 'ES', turin: 'IT', florence: 'IT', naples: 'IT', bologna: 'IT', marseille: 'FR', toulouse: 'FR', bordeaux: 'FR', nantes: 'FR', lille: 'FR', stuttgart: 'DE', dusseldorf: 'DE', leipzig: 'DE', dresden: 'DE', nuremberg: 'DE', hanover: 'DE', bonn: 'DE', basel: 'CH', lausanne: 'CH', bern: 'CH', salzburg: 'AT', graz: 'AT', gdansk: 'PL', poznan: 'PL', lodz: 'PL', brno: 'CZ', cluj: 'RO', sofia: 'BG', belgrade: 'RS', zagreb: 'HR', ljubljana: 'SI', bratislava: 'SK', vilnius: 'LT', riga: 'LV', reykjavik: 'IS', limassol: 'CY', valletta: 'MT', braga: 'PT', thessaloniki: 'GR', ankara: 'TR', izmir: 'TR', haifa: 'IL',
  'tel aviv': 'IL', dubai: 'AE', 'abu dhabi': 'AE', bangalore: 'IN', bengaluru: 'IN', mumbai: 'IN', hyderabad: 'IN', pune: 'IN', chennai: 'IN',
  delhi: 'IN', 'new delhi': 'IN', gurgaon: 'IN', gurugram: 'IN', noida: 'IN', tokyo: 'JP', seoul: 'KR', shanghai: 'CN', beijing: 'CN',
  sydney: 'AU', melbourne: 'AU', brisbane: 'AU', auckland: 'NZ', toronto: 'CA', vancouver: 'CA', montreal: 'CA', ottawa: 'CA', calgary: 'CA',
  'sao paulo': 'BR', 'mexico city': 'MX', 'buenos aires': 'AR', bogota: 'CO', santiago: 'CL', 'cape town': 'ZA', johannesburg: 'ZA',
  lagos: 'NG', nairobi: 'KE', manila: 'PH', 'kuala lumpur': 'MY', jakarta: 'ID', 'ho chi minh city': 'VN', bangkok: 'TH', istanbul: 'TR',
  // Local spellings employers use on their own boards ("München": where-sample-1, 12 Nov 2026). Accents are
  // stripped before matching, so "Köln" is "koln".
  munchen: 'DE', koln: 'DE', nurnberg: 'DE', dusseldorf: 'DE', stuttgart: 'DE', leipzig: 'DE', dresden: 'DE', hannover: 'DE', karlsruhe: 'DE',
  wien: 'AT', graz: 'AT', linz: 'AT', geneve: 'CH', basel: 'CH', bern: 'CH', lausanne: 'CH', milano: 'IT', roma: 'IT', torino: 'IT', firenze: 'IT', napoli: 'IT',
  praha: 'CZ', brno: 'CZ', warszawa: 'PL', gdansk: 'PL', poznan: 'PL', lisboa: 'PT', bruxelles: 'BE', brussel: 'BE', gent: 'BE', antwerpen: 'BE',
  'den haag': 'NL', goteborg: 'SE', kobenhavn: 'DK', bucuresti: 'RO', cluj: 'RO', athina: 'GR', sevilla: 'ES', zaragoza: 'ES',
};

export function countryCodeFromName(name) {
  if (!name) return null;
  const n = normName(name);
  if (/^[a-z]{2}$/.test(n) && n !== 'us' && n !== 'uk') return n.toUpperCase();
  return COUNTRIES[n] ?? null;
}

const wordRe = w => new RegExp(`(^|[^a-z])${w.replace(/ /g, '[^a-z]+')}($|[^a-z])`);
const UK_CITY_RES = UK_CITIES.map(c => [c, wordRe(c)]);
const UK_WORD_RES = UK_WORDS.filter(w => w !== 'gb' && w !== 'gbr').map(wordRe);
const COUNTRY_RES = Object.entries(COUNTRIES).filter(([n]) => !['uk', 'us', 'u s', 'england', 'scotland', 'wales', 'northern ireland', 'united kingdom', 'great britain', 'america'].includes(n)).map(([n, c]) => [wordRe(n), c]);
const CITY_RES = Object.entries(COUNTRY_CITIES).map(([n, c]) => [wordRe(n), c, n]);
const US_CITY_RES2 = US_CITIES.filter(c => !['sf', 'nyc', 'bay area', 'silicon valley'].includes(c)).map(c => [wordRe(c), c]);
// Region words in location strings -> region codes (see regions.mjs for the countries in each).
const REGION_RES = [
  [/\bemea\b/i, 'emea'], [/\b(europe|european)\b(?!\s+union)/i, 'europe'], [/\b(eu|european union)\b/i, 'eu'],
  [/\b(americas|amer)\b/i, 'americas'], [/\b(north america|namer|noram)\b/i, 'north-america'],
  [/\b(latam|latin america|south america)\b/i, 'latam'], [/\b(apac|apj|apjc|asia[- ]pacific)\b/i, 'apac'],
  [/\basia\b(?![- ]pacific)/i, 'asia'], [/\b(anz|oceania)\b/i, 'anz'], [/\bafrica\b/i, 'africa'], [/\b(mena|middle east)\b/i, 'mena'],
  [/\b(worldwide|global(ly)?|anywhere|international)\b/i, 'world'],
];
const US_STATE_NAME_RES = Object.values(US_STATES).filter(s => s !== 'washington' && s !== 'georgia').map(wordRe);
const US_CITY_RES = US_CITIES.map(wordRe);

/**
 * Read one location string. Returns { uk, ukCity, countries:Set, us, remote, region }.
 * Uses the raw string for state abbreviations ("Austin, TX") and a normalised form for names.
 */
function readSegment(raw = '') {
  // Place names that contain a UK word but are not in the UK.
  const s = String(raw).replace(/\bnew south wales\b/gi, 'NSW Australia').replace(/\bnew england\b/gi, 'NewEngland USA').replace(/\bprince edward island\b/gi, 'PEI Canada');
  const n = ' ' + normName(s) + ' ';
  const out = { uk: false, ukCity: null, countries: new Set(), us: false, remote: false, region: null, regions: new Set(), cities: [] };
  for (const [re, code] of REGION_RES) if (re.test(s)) out.regions.add(code);
  if (/\b(remote|anywhere|distributed|work from home|wfh|home ?based|virtual)\b/i.test(s)) out.remote = true;
  if (/\b(emea|europe|european union|\beu\b)/i.test(s)) out.region = 'europe';
  if (/\b(worldwide|global(ly)?|anywhere( in the world)?|international)\b/i.test(s)) out.region = out.region ?? 'world';
  if (/\b(americas|amer|namer|noram|north america|south america|latam|latin america|apac|apj|apjc|anz|asia pacific|asia|oceania|africa|mena|middle east)\b/i.test(s)) out.region = out.region ?? 'other';

  if (UK_WORD_RES.some(re => re.test(n)) || /(^|[\s,(])(UK|GB)($|[\s,)])/.test(s)) out.uk = true;
  // US: country words, state names, ", TX" style codes, big US cities
  if (/(^|[^a-z])(united states|usa|u s a)($|[^a-z])/.test(n) || /(^|[\s,(])(US|U\.S\.|USA)($|[\s,)\-])/.test(s)) out.us = true;
  if (US_STATE_NAME_RES.some(re => re.test(n)) || US_CITY_RES.some(re => re.test(n))) out.us = true;
  if (/,\s*([A-Z]{2})\b/.test(s)) { const code = s.match(/,\s*([A-Z]{2})\b/)[1]; if (US_STATES[code]) out.us = true; }
  for (const [re, c] of COUNTRY_RES) if (re.test(n)) out.countries.add(c);
  for (const [re, c, name] of CITY_RES) if (re.test(n)) { out.countries.add(c); out.cities.push({ country: c, city: name }); }
  for (const [re, name] of US_CITY_RES2) if (re.test(n)) out.cities.push({ country: 'US', city: name });
  { const m = s.match(/^\s*([A-Za-z .'-]{2,40}),\s*([A-Z]{2})\b/); if (m && US_STATES[m[2]]) out.cities.push({ country: 'US', city: m[1].trim().toLowerCase() }); }
  if (/\bontario\b|,\s*on\b/i.test(s)) out.countries.add('CA');

  const foreign = out.us || out.countries.size > 0;
  const hits = UK_CITY_RES.map(([c, re]) => [c, n.search(re)]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
  for (const [c] of hits) {
    // A UK town name next to a foreign country or US state is a foreign place (London, ON; Preston Rd, TX).
    if (foreign && !out.uk) continue;
    out.uk = true;
    if (!out.ukCity && !/shire$|^(kent|surrey|essex|sussex|west sussex|east sussex|devon|cornwall|somerset|dorset|norfolk|suffolk|fife|midlothian|lanarkshire|merseyside|yorkshire|north yorkshire|west yorkshire|south yorkshire|greater london|greater manchester|west midlands|east midlands|tyne and wear|city of london|canary wharf)$/.test(c)) out.ukCity = c;
    if (c === 'canary wharf' || c === 'city of london' || c === 'greater london') out.ukCity = out.ukCity ?? 'london';
  }
  if (out.uk) out.countries.delete('GB');
  return out;
}

/**
 * Read a location string that may hold several places ("Cardiff, London or Remote (UK)", "London / Stockholm",
 * "1000 N Preston Rd, Prosper, TX"). Each part is read on its own, so a UK city name inside a foreign address
 * ("Preston Rd ... TX") doesn't count, then the parts are merged.
 */
export function readLocation(raw = '') {
  const parts = String(raw).split(/\s*(?:;|\/|\||\s-\s|\bor\b|\band\b|&)\s*/i).filter(p => p && p.trim());
  const segs = (parts.length ? parts : [String(raw)]).map(readSegment);
  // A part with only a city ("London" in "London / Stockholm") still uses the whole string's UK words.
  const whole = readSegment(raw);
  const out = { uk: false, ukCity: null, countries: new Set(), us: false, remote: whole.remote, region: whole.region, regions: new Set(), cities: [] };
  for (const g of segs) {
    if (g.uk) { out.uk = true; out.ukCity = out.ukCity ?? g.ukCity; }
    if (g.us) out.us = true;
    for (const c of g.countries) out.countries.add(c);
    // A region next to a country in the same part only labels it: "Remote - APAC ( Singapore )" is Singapore,
    // not all of Asia-Pacific (sample where-sample-1 #34, 12 Nov 2026).
    if (!g.countries.size && !g.uk && !g.us) for (const r of g.regions) out.regions.add(r);
    for (const c of g.cities) if (!out.cities.some(x => x.city === c.city && x.country === c.country)) out.cities.push(c);
    if (g.region === 'world') out.region = 'world';
    else if (g.region === 'europe' && out.region !== 'world') out.region = 'europe';
    else if (g.region && !out.region) out.region = g.region;
  }
  // Explicit UK words anywhere in the string ("Remote (UK)") make it UK even if a part had no city.
  if (!out.uk && whole.uk && segs.some(g => !g.us && g.countries.size === 0)) { out.uk = true; out.ukCity = out.ukCity ?? whole.ukCity; }
  if (out.ukCity) out.cities.unshift({ country: 'GB', city: out.ukCity });
  return out;
}

/** Every country a location string names, as ISO codes (GB and US included). */
export function locationCountries(loc) {
  const set = new Set(loc.countries);
  if (loc.uk) set.add('GB');
  if (loc.us) set.add('US');
  return set;
}
