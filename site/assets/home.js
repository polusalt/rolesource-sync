// Home page: default "I can apply from" and saved searches with their new-job counts (PRD B3 flow 2, journey 4).
import { loadIndex, collect, matcher, readParams, guessCountry, loadSaved, storeSaved } from './search.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

(async () => {
  let index;
  try { index = await loadIndex(); } catch { return; }
  const sel = document.querySelector('[data-default-from]');
  if (sel && !sel.value) sel.value = guessCountry(index);

  const sec = document.getElementById('saved');
  const list = document.querySelector('[data-saved-list]');
  const draw = async () => {
    const saved = loadSaved();
    sec.hidden = !saved.length;
    list.innerHTML = saved.map((s, i) => `<li><a href="/jobs/?${esc(s.qs)}" data-open="${i}">${esc(s.label)}</a><span class="saved-new" data-count="${i}">Counting…</span><button type="button" data-remove="${i}">Remove</button></li>`).join('');
    for (const [i, s] of saved.entries()) {
      const p = readParams(new URLSearchParams(s.qs));
      const m = matcher(p);
      const jobs = await collect(index, { ...p, q: p.q || ' ' }).catch(() => null); // full load: "new" can be any role
      const el = list.querySelector(`[data-count="${i}"]`);
      if (!el) continue;
      if (!jobs) { el.textContent = ''; continue; }
      const n = jobs.filter(j => m(j) && j.fd > s.seenDay).length;
      el.textContent = n === 1 ? '1 new job' : `${n.toLocaleString('en-GB')} new jobs`;
    }
  };
  list.addEventListener('click', e => {
    const rm = e.target.closest('[data-remove]');
    if (rm) { const s = loadSaved(); s.splice(Number(rm.dataset.remove), 1); storeSaved(s); draw(); return; }
    const open = e.target.closest('[data-open]');
    if (open) { const s = loadSaved(); const x = s[Number(open.dataset.open)]; if (x) { x.seenDay = Math.floor(Date.parse(index.gen) / 86400000); storeSaved(s); } }
  });
  draw();
})();
