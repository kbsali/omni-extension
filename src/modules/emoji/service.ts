export interface EmojiEntry {
  char: string;
  name: string;
  keywords: string[];
}

export interface ScoredEmoji {
  entry: EmojiEntry;
  score: number;
  index: number;
}

function scoreString(
  target: string,
  query: string,
  exactBonus: number,
  startsWithBonus: number,
  includesBonus: number,
): number {
  if (target === query) return exactBonus;
  if (target.startsWith(query)) return startsWithBonus;
  if (target.includes(query)) return includesBonus;
  return 0;
}

function isSubsequence(haystack: string, needle: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return i === needle.length;
}

function scoreEntry(entry: EmojiEntry, query: string): number {
  let best = 0;

  // Exact / startsWith / includes on the name.
  const nameScore = scoreString(entry.name, query, 1000, 500, 100);
  if (nameScore > best) best = nameScore;

  // Word-in-name startsWith (e.g. query "face" matches "grinning face").
  for (const word of entry.name.split(/\s+/)) {
    if (word !== entry.name && word.startsWith(query)) {
      if (300 > best) best = 300;
      break;
    }
  }

  // Keyword matches.
  for (const keyword of entry.keywords) {
    const kwScore = scoreString(keyword, query, 250, 150, 50);
    if (kwScore > best) best = kwScore;
  }

  // Subsequence fallback on name, only if nothing matched yet.
  if (best === 0 && isSubsequence(entry.name, query)) {
    best = 10;
  }

  return best;
}

export function pushRecent(recents: readonly string[], char: string, max: number): string[] {
  const withoutChar = recents.filter((c) => c !== char);
  const next = [char, ...withoutChar];
  return next.slice(0, max);
}

export function fuzzyFilter(query: string, entries: readonly EmojiEntry[]): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...entries];

  const scored: ScoredEmoji[] = [];
  entries.forEach((entry, index) => {
    const score = scoreEntry(entry, q);
    if (score > 0) scored.push({ entry, score, index });
  });

  // Sort by score desc, ties broken by original index (stable).
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((s) => s.entry);
}
