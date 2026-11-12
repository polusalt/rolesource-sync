// JobPosting markup for single-job pages only (CLAUDE.md; RULES - Google for Jobs, J2/J5/J7/J8).
// Returns null when a job can't be marked up honestly; the page is still built, just without markup.
import { postedIso, cityName, remoteCountries, employmentCode } from './format.mjs';

const UNIT = { year: 'YEAR', month: 'MONTH', week: 'WEEK', day: 'DAY', hour: 'HOUR' };

export function jobPosting(j, descriptionHtml) {
  if (!descriptionHtml || descriptionHtml.length < 200) return null; // PROP-3: full description only
  const ld = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: j.title,
    description: descriptionHtml,
    datePosted: postedIso(j),
    hiringOrganization: { '@type': 'Organization', name: j.employer },
    identifier: { '@type': 'PropertyValue', name: j.employer, value: String(j.atsJobId) },
    directApply: false, // J8: people apply on the employer's own site
  };
  if (j.workType === 'remote') {
    // J7: remote jobs need at least one eligible country. Worldwide or unclear reach has none, so no markup.
    const ccs = remoteCountries(j.remote);
    if (!ccs.length) return null;
    ld.jobLocationType = 'TELECOMMUTE';
    ld.applicantLocationRequirements = ccs.map(cc => ({ '@type': 'Country', name: cc }));
  } else {
    const places = j.cities?.length
      ? j.cities.map(c => ({ '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: cityName(c.city), addressCountry: c.country } }))
      : (j.located ?? []).map(cc => ({ '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: cc } }));
    if (!places.length) return null; // PROP-5: addressCountry is mandatory
    ld.jobLocation = places.length === 1 ? places[0] : places;
  }
  const et = employmentCode(j.employmentType);
  if (et) ld.employmentType = et;
  const s = j.salary;
  if (s && UNIT[s.period] && (s.min != null || s.max != null)) {
    const value = { '@type': 'QuantitativeValue', unitText: UNIT[s.period] };
    if (s.min != null && s.max != null && s.min !== s.max) { value.minValue = s.min; value.maxValue = s.max; } else value.value = s.min ?? s.max;
    ld.baseSalary = { '@type': 'MonetaryAmount', currency: s.currency, value };
  }
  return ld;
}

// Safe inside <script type="application/ld+json">: no "</script>" or "<!--" can close it early.
export const ldScript = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
