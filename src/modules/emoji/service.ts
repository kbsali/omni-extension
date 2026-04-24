export function pushRecent(
  recents: readonly string[],
  char: string,
  max: number,
): string[] {
  const withoutChar = recents.filter((c) => c !== char);
  const next = [char, ...withoutChar];
  return next.slice(0, max);
}
