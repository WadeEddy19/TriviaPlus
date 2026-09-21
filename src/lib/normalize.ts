/**
 * Normalize an answer string for matching. Applied identically to accepted
 * answers and to player input:
 *   1. Unicode NFD, strip combining marks
 *   2. Lowercase
 *   3. Replace "&" with "and"
 *   4. Remove everything except letters, digits and spaces
 *   5. Collapse whitespace and trim
 *   6. Strip a leading "the "
 */
export function normalize(input: string): string {
  let s = input.normalize('NFD').replace(/\p{M}/gu, '');
  s = s.toLowerCase();
  // Pad with spaces so "Bosnia&Herzegovina" and "Bosnia & Herzegovina" agree;
  // step 5 collapses the extra whitespace.
  s = s.replace(/&/g, ' and ');
  s = s.replace(/\s/g, ' ');
  s = s.replace(/[^\p{L}\p{N} ]/gu, '');
  s = s.replace(/ +/g, ' ').trim();
  s = s.replace(/^the /, '');
  return s;
}

/**
 * Like normalize, but punctuation becomes a word break instead of vanishing,
 * so "Guinea-Bissau" also accepts "guinea bissau" (normalize alone gives
 * "guineabissau").
 */
function normalizeSpaced(input: string): string {
  const spaced = input.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}\s&]/gu, ' ');
  return normalize(spaced);
}

export interface AnswerStrings {
  display: string;
  aliases?: string[];
}

/** Normalized accepted strings for one answer (display first, deduped, non-empty). */
export function acceptedStrings(answer: AnswerStrings): string[] {
  const out = new Set<string>();
  for (const raw of [answer.display, ...(answer.aliases ?? [])]) {
    const n = normalize(raw);
    if (n) out.add(n);
  }
  return [...out];
}

/**
 * Every normalized key that should match each answer of a quiz: the
 * accepted strings plus their punctuation-as-space variants. A variant is
 * dropped if it would collide with a different answer.
 */
export function matchKeysForQuiz(answers: AnswerStrings[]): string[][] {
  const base = answers.map(acceptedStrings);
  const owner = new Map<string, number>();
  base.forEach((keys, i) => keys.forEach((k) => owner.set(k, i)));

  return answers.map((answer, i) => {
    const keys = new Set(base[i]);
    for (const raw of [answer.display, ...(answer.aliases ?? [])]) {
      const v = normalizeSpaced(raw);
      if (!v || keys.has(v)) continue;
      const o = owner.get(v);
      if (o !== undefined && o !== i) continue;
      owner.set(v, i);
      keys.add(v);
    }
    return [...keys];
  });
}
