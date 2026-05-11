import type { HomeboxTarget } from "~/lib/scanner/parse-homebox-url";

export function buildTagUrl(target: HomeboxTarget, origin: string): string {
  const trimmed = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const segment = target.kind === "item" ? "items" : "locations";
  return `${trimmed}/${segment}/${target.id}`;
}
