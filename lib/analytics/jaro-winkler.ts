/** Jaro-Winkler similarity in [0, 1]. Prefix scale 0.1, max prefix 4. */

export function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const s1Matches = Array.from({ length: len1 }, () => false);
  const s2Matches = Array.from({ length: len2 }, () => false);
  let matches = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  );
}

export function jaroWinkler(s1: string, s2: string, prefixScale = 0.1): number {
  const j = jaro(s1, s2);
  let prefix = 0;
  const limit = Math.min(4, s1.length, s2.length);
  while (prefix < limit && s1[prefix] === s2[prefix]) prefix++;
  return j + prefix * prefixScale * (1 - j);
}

export function tokenSortKey(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join(" ");
}

export function tokenSortJaroWinkler(a: string, b: string): number {
  return jaroWinkler(tokenSortKey(a), tokenSortKey(b));
}
