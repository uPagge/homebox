import { parseHomeboxTarget, type HomeboxTarget } from "./parse-homebox-url";

export type ScanPickKind = HomeboxTarget["kind"];

export type ScanPickAction =
  | { type: "pick"; target: HomeboxTarget }
  | { type: "mismatch"; accepts: readonly ScanPickKind[] }
  | { type: "not_homebox" };

export function decideScanPickAction(
  text: string,
  accepts: readonly ScanPickKind[],
): ScanPickAction {
  const target = parseHomeboxTarget(text);
  if (!target) return { type: "not_homebox" };
  if (!accepts.includes(target.kind)) {
    return { type: "mismatch", accepts };
  }
  return { type: "pick", target };
}
