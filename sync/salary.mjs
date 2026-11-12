// Salary: shown only when the employer states it, and only when it passes sanity checks (PRD B4).
const SYMBOLS = {
  '£': 'GBP', '€': 'EUR', '$': 'USD', 'US$': 'USD', 'C$': 'CAD', 'CA$': 'CAD', 'A$': 'AUD', 'AU$': 'AUD', 'S$': 'SGD', 'NZ$': 'NZD', 'R$': 'BRL', 'HK$': 'HKD',
  '₹': 'INR', '¥': 'JPY', '₪': 'ILS', 'zł': 'PLN', 'R': 'ZAR',
  GBP: 'GBP', EUR: 'EUR', USD: 'USD', CAD: 'CAD', AUD: 'AUD', NZD: 'NZD', SGD: 'SGD', HKD: 'HKD', CHF: 'CHF', INR: 'INR', JPY: 'JPY', PLN: 'PLN',
  SEK: 'SEK', NOK: 'NOK', DKK: 'DKK', CZK: 'CZK', HUF: 'HUF', RON: 'RON', BRL: 'BRL', MXN: 'MXN', ZAR: 'ZAR', AED: 'AED', ILS: 'ILS',
};
const CURRENCY_TOKEN = String.raw`(US\$|CA\$|AU\$|NZ\$|HK\$|C\$|A\$|S\$|R\$|£|€|\$|₹|¥|₪|zł|GBP|EUR|USD|CAD|AUD|NZD|SGD|HKD|CHF|INR|JPY|PLN|SEK|NOK|DKK|CZK|HUF|RON|BRL|MXN|ZAR|AED|ILS)`;

// Plausible ranges per period in GBP/EUR/USD terms, scaled by roughly how many units of each currency make one
// pound/euro/dollar. Only a sanity check, so round numbers are fine.
const BOUNDS = { year: [5000, 1500000], month: [500, 100000], week: [100, 25000], day: [50, 5000], hour: [5, 1000] };
const SCALE = { GBP: 1, EUR: 1, USD: 1, CHF: 1, CAD: 1.4, AUD: 1.5, NZD: 1.7, SGD: 1.3, HKD: 8, PLN: 4, SEK: 11, NOK: 11, DKK: 7, CZK: 23, HUF: 360, RON: 5, INR: 85, JPY: 150, BRL: 5.5, MXN: 18, ZAR: 18, AED: 3.7, ILS: 3.7 };
const EURO = ['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'];
export const LOCAL_CURRENCY = {
  GB: 'GBP', US: 'USD', CH: 'CHF', NO: 'NOK', SE: 'SEK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', CA: 'CAD', AU: 'AUD', NZ: 'NZD',
  SG: 'SGD', HK: 'HKD', IN: 'INR', JP: 'JPY', BR: 'BRL', MX: 'MXN', ZA: 'ZAR', AE: 'AED', IL: 'ILS', ...Object.fromEntries(EURO.map(c => [c, 'EUR'])),
};
const DOLLAR_COUNTRIES = { CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', HK: 'HKD', MX: 'MXN' };

function num(s, k) {
  let v = parseFloat(String(s).replace(/,/g, ''));
  if (Number.isNaN(v)) return null;
  if (k && /k/i.test(k)) v *= 1000;
  return v;
}

// Explicit "per X" wording only: "12 months FTC" or "monthly bonus" must not make an annual salary monthly.
function periodFrom(text) {
  if (/(?:per|an?|\/)\s*(?:year|annum|yr)\b|\bp\.?a\.?(?=\W|$)|\b(?:annual(?:ly)?|yearly)\s+(?:salary|base|pay)|\bper\s+annum/i.test(text)) return 'year';
  if (/(?:per|an?|\/)\s*(?:hour|hr)\b|\bhourly\s+(?:rate|pay|wage)/i.test(text)) return 'hour';
  if (/(?:per|a|\/)\s*day\b|\bday\s*rate|\bdaily\s+rate/i.test(text)) return 'day';
  if (/(?:per|a|\/)\s*week\b|\bweekly\s+(?:pay|salary|wage)/i.test(text)) return 'week';
  if (/(?:per|a|\/)\s*month\b|\bpcm\b|\bmonthly\s+(?:salary|pay|stipend)/i.test(text)) return 'month';
  if (/\bsalary\b|\bannual\b/i.test(text)) return 'year';
  return null;
}

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(k|K)?`;
const RANGE_RE = new RegExp(`${CURRENCY_TOKEN}\\s?${NUM}(?:\\s*(?:-|–|—|to)\\s*${CURRENCY_TOKEN}?\\s?${NUM})?`);

/** Find a stated salary in free text (advert or ATS compensation summary). */
export function parseSalaryText(text = '') {
  if (!text) return null;
  const lines = String(text).split(/\n|(?<=\.)\s/);
  for (const line of lines) {
    const m = line.match(RANGE_RE);
    if (!m) continue;
    if (!/salary|\bpay\b|compensation|base|range|per\s|annum|rate|\bOTE\b|package|earn/i.test(line)) continue;
    // Benefits quote money too ("Fertility HRA (up to $10,000 per year)", "$2,000 learning budget"). Such lines
    // count only when they also name the salary itself ("Salary £80k + bonus").
    if (/\b(stipend|budget|allowance|reimburs\w*|HRA|FSA|HSA|401\(?k\)?|insurance|learning|wellness|relocation|sign[- ]on|signing|referral|fertility|childcare|gym|home office|per diem|equipment)\b/i.test(line)
      && !/\b(salary|base pay|pay range|compensation range|base compensation)\b/i.test(line)
      && !/\bintern(ship)?s?\b[^.\n]{0,30}\bstipend|\bstipend\b[^.\n]{0,30}\bintern/i.test(line)) continue; // an intern's stipend is their pay
    if (/\b(million|billion|bn\b|funding|raised|series [a-f]\b|revenue|valuation)/i.test(line)) continue;
    // On-target earnings and commission-only pay are not a salary: never shown as one.
    if (/\bOTE\b|on[- ]target|commission[- ]only|uncapped commission/i.test(line)) continue;
    const currency = SYMBOLS[m[1]] ?? null;
    let min = num(m[2], m[3]);
    let max = m[5] ? num(m[5], m[6] ?? m[3]) : null;
    if (max != null && min != null && max < min) [min, max] = [max, min];
    const period = periodFrom(line) ?? (min >= 15000 ? 'year' : null);
    // A bare "$" is the local dollar in Canada, Australia, Singapore...: resolved in resolveSalary.
    return { min, max, currency, period, source: 'advert', bareDollar: m[1] === '$' };
  }
  return null;
}

/**
 * Pick the salary to show, then sanity-check it. Returns null when nothing trustworthy is stated.
 * @param {object} job raw job with salaryStructured, salaryText, descriptionText
 * @param {string[]} located ISO codes of the countries the job is in ([] for remote with no country)
 */
export function resolveSalary(job, located = []) {
  let s = job.salaryStructured ? { ...job.salaryStructured, source: 'ats' } : null;
  if (!s && job.salaryText) s = parseSalaryText(job.salaryText);
  if (!s) s = parseSalaryText(job.descriptionText);
  if (!s || (s.min == null && s.max == null)) return null;
  const local = [...new Set(located.map(c => LOCAL_CURRENCY[c]).filter(Boolean))];
  if (s.bareDollar && located.length === 1 && DOLLAR_COUNTRIES[located[0]]) s.currency = DOLLAR_COUNTRIES[located[0]];
  if (!s.currency || !s.period || !SCALE[s.currency]) return null;
  const [lo, hi] = BOUNDS[s.period].map(v => v * SCALE[s.currency]);
  for (const v of [s.min, s.max]) if (v != null && (v < lo || v > hi)) return null;
  if (s.min != null && s.max != null && s.max > s.min * 4) return null;
  // A job in one country paid in a currency that is neither local nor USD/EUR is almost always a data error
  // (CareerHound showed rupees on a Paris job). For a salary taken from advert text in a single-currency
  // location, require the local currency: "$150k" in a UK advert is usually the US pay range for the same role.
  if (local.length && !local.includes(s.currency) && !['USD', 'EUR'].includes(s.currency)) return null;
  if (local.length === 1 && s.source === 'advert' && s.currency !== local[0]) return null;
  return { min: s.min ?? null, max: s.max ?? null, currency: s.currency, period: s.period, source: s.source };
}

export function formatSalary(s) {
  if (!s) return '';
  const sym = { GBP: '£', EUR: '€', USD: '$', CAD: 'C$', AUD: 'A$', INR: '₹', JPY: '¥' }[s.currency] ?? s.currency + ' ';
  const f = v => (s.period === 'year' && v >= 1000 ? `${sym}${Math.round(v / 1000)}k` : `${sym}${v.toLocaleString('en-GB')}`);
  const range = s.min != null && s.max != null && s.min !== s.max ? `${f(s.min)}–${f(s.max)}` : f(s.min ?? s.max);
  return `${range} a ${s.period}`;
}
