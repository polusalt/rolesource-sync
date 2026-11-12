// English-language adverts only at launch (PRD A12). A simple, explainable test: the share of the most common
// English function words among all words. English adverts score about 0.15–0.30; German, French, Spanish,
// Dutch and Portuguese adverts score well under 0.05 (they share almost none of these words).
const EN = new Set(['the', 'and', 'to', 'of', 'a', 'in', 'you', 'for', 'with', 'our', 'is', 'we', 'will', 'are', 'on', 'as', 'be', 'your', 'an', 'this', 'that', 'or', 'at', 'by', 'from', 'have', 'who', 'what', 'about', 'role', 'team', 'work', 'experience']);

export function englishScore(text = '') {
  const words = String(text).toLowerCase().match(/[a-zà-ÿ]+/g) ?? [];
  if (words.length < 20) return null; // too short to tell
  let hits = 0;
  for (const w of words) if (EN.has(w)) hits++;
  return hits / words.length;
}

/** True when the advert is English, or too short to tell (then the title decides nothing: kept). */
export function isEnglish(text = '') {
  const s = englishScore(text);
  return s == null || s >= 0.08;
}
