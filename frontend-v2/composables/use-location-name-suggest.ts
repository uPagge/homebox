import { computed, type ComputedRef, type Ref } from "vue";
import { useLocationTree } from "./use-location-tree";

export type Separator = " " | "-" | "_" | "." | "";

export interface ParsedName {
  prefix: string;
  separator: Separator;
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
    separator: m[2] as Separator,
    num: Number(m[3]),
  };
}

export interface SiblingLite {
  id: string;
  name: string;
  // Optional full hierarchy path ("Гараж › Шкаф › Коробка 1"). Live UI uses
  // it for chips so colliding leaves under different parents are
  // distinguishable; tests and other callers can omit it.
  pathString?: string;
}

export interface NameSuggestion {
  name: string;
  separator: Separator;
  nextNumber: number;
}

export interface SuggestState {
  existing: SiblingLite[];
  suggestion: NameSuggestion | null;
  parentName: string | null;
}

const TRAILING_NUMBER_RE = /[\s\-_.]?\d+$/;

function pickDominantSeparator(separators: Separator[]): Separator {
  if (separators.length === 0) return " ";
  const counts = new Map<Separator, number>();
  for (const s of separators) {
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best: Separator = " ";
  let bestCount = -1;
  for (const [sep, count] of counts) {
    if (count > bestCount || (count === bestCount && sep === " ")) {
      best = sep;
      bestCount = count;
    }
  }
  return best;
}

export function computeSuggestion(
  input: string,
  siblings: SiblingLite[],
  parentName: string | null,
): SuggestState {
  const trimmed = input.trim();
  const empty: SuggestState = { existing: [], suggestion: null, parentName };

  if (!trimmed) return empty;
  if (TRAILING_NUMBER_RE.test(trimmed)) return empty;

  const inputKey = trimmed.toLocaleLowerCase();

  const matched: { sibling: SiblingLite; separator: Separator; num: number }[] = [];
  for (const sibling of siblings) {
    const parsed = parseNumberedName(sibling.name);
    if (!parsed) continue;
    if (parsed.prefix.toLocaleLowerCase() !== inputKey) continue;
    matched.push({ sibling, separator: parsed.separator, num: parsed.num });
  }

  if (matched.length === 0) return empty;

  matched.sort((a, b) => a.num - b.num);

  const maxNum = matched[matched.length - 1].num;
  const separator = pickDominantSeparator(matched.map(m => m.separator));
  const nextNumber = maxNum + 1;

  return {
    existing: matched.map(m => m.sibling),
    suggestion: {
      name: `${trimmed}${separator}${nextNumber}`,
      separator,
      nextNumber,
    },
    parentName,
  };
}

// Suggest scope is global: matches the user's mental model of a single
// sequential numbering across the whole DB (e.g. «Коробка N» wherever it
// lives). The parent picker no longer narrows the suggestion — it only
// determines where the new location will be placed. Siblings-only scope is
// preserved as `tree.getSiblings(...)` for future call sites that may want it.
export function useLocationNameSuggest(
  name: Ref<string>,
): ComputedRef<SuggestState> {
  const tree = useLocationTree();

  return computed(() => {
    return computeSuggestion(name.value, tree.getAll(), null);
  });
}
