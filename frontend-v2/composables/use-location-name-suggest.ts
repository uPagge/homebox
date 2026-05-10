export interface ParsedName {
  prefix: string;
  separator: string;
  num: number;
}

const NAME_RE = /^(.+?)([\s\-_.]?)(\d+)$/;

export function parseNumberedName(input: string): ParsedName | null {
  const trimmed = input.trim();
  const m = NAME_RE.exec(trimmed);
  if (!m) return null;
  const prefix = m[1];
  if (!prefix) return null;
  // Reject all-digit prefixes — "42" is not a numbered name with prefix "4".
  if (!/\D/.test(prefix)) return null;
  return {
    prefix,
    separator: m[2],
    num: Number(m[3]),
  };
}
