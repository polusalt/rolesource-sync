// Which countries each hiring region covers. Used to answer "can someone in country X apply?".
// Region words in adverts are loose; these lists are the conservative reading and are tested.
export const EU27 = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const EUROPE_NON_EU = ['GB', 'NO', 'CH', 'IS', 'LI', 'UA', 'RS', 'BA', 'ME', 'MK', 'AL', 'MD', 'XK'];
const MENA = ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'IL', 'JO', 'LB', 'EG', 'MA', 'TN', 'DZ', 'TR'];
const AFRICA = ['ZA', 'NG', 'KE', 'GH', 'MA', 'EG', 'TN', 'DZ', 'ET', 'UG', 'RW', 'TZ', 'SN', 'CI', 'CM', 'ZW', 'ZM', 'BW', 'MU', 'NA'];
const NORTH_AMERICA = ['US', 'CA', 'MX'];
const LATAM = ['MX', 'BR', 'AR', 'CO', 'CL', 'PE', 'UY', 'CR', 'PA', 'EC', 'GT', 'DO', 'BO', 'PY', 'VE', 'SV', 'HN', 'NI', 'PR'];
const ASIA = ['SG', 'JP', 'KR', 'CN', 'HK', 'TW', 'IN', 'ID', 'MY', 'PH', 'TH', 'VN', 'PK', 'BD', 'LK', 'NP'];
const ANZ = ['AU', 'NZ'];

export const REGIONS = {
  eu: EU27,
  europe: [...EU27, ...EUROPE_NON_EU],
  emea: [...new Set([...EU27, ...EUROPE_NON_EU, ...MENA, ...AFRICA])],
  mena: MENA,
  africa: AFRICA,
  'north-america': NORTH_AMERICA,
  latam: LATAM,
  americas: [...new Set([...NORTH_AMERICA, ...LATAM])],
  asia: ASIA,
  apac: [...ASIA, ...ANZ],
  anz: ANZ,
};

export const REGION_LABELS = {
  eu: 'the EU', europe: 'Europe', emea: 'Europe, Middle East and Africa', mena: 'Middle East and North Africa', africa: 'Africa',
  'north-america': 'North America', latam: 'Latin America', americas: 'the Americas', asia: 'Asia', apac: 'Asia-Pacific', anz: 'Australia and New Zealand',
};

export function regionIncludes(region, cc) {
  return region === 'world' || (REGIONS[region] ?? []).includes(cc);
}
