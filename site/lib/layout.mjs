// Page shell: head, floating nav (DESIGN.md: from reference B), footer.
import { esc } from './format.mjs';

export const ASSET_V = '1';

const GLOBE = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M1.75 8h12.5M8 1.75c1.9 2 2.6 4 2.6 6.25S9.9 12.25 8 14.25C6.1 12.25 5.4 10.25 5.4 8S6.1 3.75 8 1.75z"/></svg>';
export const icon = { globe: GLOBE };

export function page({ site, path, title, description, body, head = '', scripts = [], noindex = false, bodyClass = '' }) {
  const canonical = site.url + path;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="theme-color" content="#FFCD00">
<link rel="preload" href="/fonts/work-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/bricolage-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css?v=${ASSET_V}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${head}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="nav-wrap">
  <nav class="nav" aria-label="Main">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span>RoleSource</a>
    <div class="nav-tabs">
      <a class="tab" href="/jobs/?wt=remote">Remote jobs</a>
      <a class="tab" href="/is-this-job-real/">Is this job real?</a>
      <a class="tab" href="/how-it-works/">How it works</a>
    </div>
    <a class="btn btn-ink nav-cta" href="/jobs/">Search jobs</a>
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <p class="foot-brand"><span class="brand-mark" aria-hidden="true"></span>RoleSource</p>
    <p>Jobs straight from employers' own careers pages, read through their public job-board systems and checked every day. Closed jobs are removed at the next check.</p>
    <p><a href="/how-it-works/">How it works</a> · <a href="/jobs/">Search jobs</a> · <a href="/is-this-job-real/">Is this job real?</a></p>
  </div>
</footer>
${scripts.map(s => `<script type="module" src="${s}?v=${ASSET_V}"></script>`).join('\n')}
</body>
</html>
`;
}
