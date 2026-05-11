import { parseHomeboxTarget, type HomeboxTarget } from "./parse-homebox-url";

export type ScanPickKind = HomeboxTarget["kind"];

export type ScanPickAction =
  | { type: "pick"; target: HomeboxTarget }
  | { type: "mismatch"; expected: ScanPickKind | "either" }
  | { type: "not_homebox" };

export function decideScanPickAction(
  text: string,
  accepts: readonly ScanPickKind[],
): ScanPickAction {
  const target = parseHomeboxTarget(text);
  if (!target) return { type: "not_homebox" };
  if (!accepts.includes(target.kind)) {
    const expected: ScanPickKind | "either" =
      accepts.length === 1 ? accepts[0]! : "either";
    return { type: "mismatch", expected };
  }
  return { type: "pick", target };
}
