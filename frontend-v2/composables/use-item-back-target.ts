export type BackTarget = {
  label: string;
  to: string | null;
};

const FALLBACK_LABEL = "Назад";

export function resolveItemBackTarget(
  from: string | undefined,
  getName: (id: string) => string | null,
): BackTarget {
  if (!from) {
    return { label: FALLBACK_LABEL, to: null };
  }
  const name = getName(from);
  return {
    label: name ?? FALLBACK_LABEL,
    to: `/locations/${from}`,
  };
}
