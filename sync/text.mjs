// HTML and text helpers shared by every ATS adapter.
import sanitizeHtml from 'sanitize-html';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', pound: '£', euro: '€' };

export function decodeEntities(s = '') {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Allow-list sanitising of advert HTML before it is ever rendered (PRD B11). */
export function cleanHtml(html = '') {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'h2', 'h3', 'h4', 'a', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: { a: ['href', 'rel', 'target'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    transformTags: {
      h1: 'h2', h5: 'h4', h6: 'h4', div: 'p',
      a: (tag, attribs) => ({ tagName: 'a', attribs: { href: attribs.href, rel: 'nofollow noopener', target: '_blank' } }),
    },
    exclusiveFilter: frame => ['p', 'li', 'strong', 'em', 'b', 'i'].includes(frame.tag) && !frame.text.trim() && !frame.mediaChildren?.length,
  }).replace(/(<p>\s*<\/p>\s*)+/g, '').trim();
}

export function htmlToText(html = '') {
  return decodeEntities(String(html).replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

export function slugify(s = '') {
  return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function normName(s = '') {
  return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function toIso(v) {
  if (v == null || v === '') return null;
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v).replace(' UTC', 'Z').replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
