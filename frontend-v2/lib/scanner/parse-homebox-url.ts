// Maps both legacy (singular) and v2 (plural) entity segments to v2 paths.
// Old QR labels printed from /item/, /location/, /label/, /tag/ are rewritten
// to v2's /items/, /locations/, /labels/. Origin is ignored — we always
// navigate locally.
const SEGMENT_TO_V2: Record<string, string> = {
  item: "items",
  items: "items",
  location: "locations",
  locations: "locations",
  label: "labels",
  labels: "labels",
  tag: "labels",
  tags: "labels",
};

const PATH_RX = /^\/(items?|locations?|labels?|tags?)\/([0-9a-f-]{36})(?:\/|$)/i;

export function parseHomeboxUrl(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const m = url.pathname.match(PATH_RX);
  if (!m) return null;
  const target = SEGMENT_TO_V2[m[1]!.toLowerCase()];
  if (!target) return null;
  return `/${target}/${m[2]}`;
}
