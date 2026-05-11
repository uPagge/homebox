export type BackTarget =
  | { kind: "back"; label: string }
  | { kind: "navigate"; label: string; to: string };

const FALLBACK_LABEL = "Назад";

export function resolveItemBackTarget(
  from: string | undefined,
  getName: (id: string) => string | null,
): BackTarget {
  if (!from) {
    return { kind: "back", label: FALLBACK_LABEL };
  }
  const name = getName(from);
  return {
    kind: "navigate",
    label: name || FALLBACK_LABEL,
    to: `/locations/${from}`,
  };
}
