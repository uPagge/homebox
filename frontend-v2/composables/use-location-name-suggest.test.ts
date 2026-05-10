import { describe, expect, test } from "vitest";
import { computeSuggestion, parseNumberedName } from "./use-location-name-suggest";

describe("parseNumberedName", () => {
  test("space separator", () => {
    expect(parseNumberedName("Коробка 4")).toEqual({ prefix: "Коробка", separator: " ", num: 4 });
  });

  test("dash separator", () => {
    expect(parseNumberedName("Box-12")).toEqual({ prefix: "Box", separator: "-", num: 12 });
  });

  test("no separator", () => {
    expect(parseNumberedName("Bin5")).toEqual({ prefix: "Bin", separator: "", num: 5 });
  });

  test("dot separator", () => {
    expect(parseNumberedName("v.7")).toEqual({ prefix: "v", separator: ".", num: 7 });
  });

  test("underscore separator", () => {
    expect(parseNumberedName("row_3")).toEqual({ prefix: "row", separator: "_", num: 3 });
  });

  test("no number → null", () => {
    expect(parseNumberedName("Коробка")).toBeNull();
  });

  test("empty string → null", () => {
    expect(parseNumberedName("")).toBeNull();
  });

  test("only digits → null (no prefix)", () => {
    expect(parseNumberedName("42")).toBeNull();
  });

  test("trims surrounding whitespace before parsing", () => {
    expect(parseNumberedName("  Коробка 9  ")).toEqual({ prefix: "Коробка", separator: " ", num: 9 });
  });
});

const sib = (id: string, name: string) => ({ id, name });

describe("computeSuggestion", () => {
  test("empty input → no suggestion", () => {
    const r = computeSuggestion("", [sib("1", "Коробка 1")], null);
    expect(r.suggestion).toBeNull();
    expect(r.existing).toEqual([]);
  });

  test("input ends with number → no suggestion (user took control)", () => {
    const r = computeSuggestion("Коробка 5", [sib("1", "Коробка 1")], null);
    expect(r.suggestion).toBeNull();
  });

  test("input exactly equals an existing sibling → no suggestion (locks trailing-number gate)", () => {
    const r = computeSuggestion("Box 1", [sib("1", "Box 1")], null);
    expect(r.suggestion).toBeNull();
  });

  test("zero matching siblings → no suggestion", () => {
    const r = computeSuggestion("Стол", [sib("1", "Коробка 1")], null);
    expect(r.suggestion).toBeNull();
    expect(r.existing).toEqual([]);
  });

  test("three space-separated matches → suggest max+1, sorted asc", () => {
    const siblings = [
      sib("3", "Коробка 3"),
      sib("1", "Коробка 1"),
      sib("2", "Коробка 2"),
    ];
    const r = computeSuggestion("Коробка", siblings, "Shelf A");
    expect(r.suggestion).toEqual({ name: "Коробка 4", separator: " ", nextNumber: 4 });
    expect(r.existing.map(s => s.name)).toEqual(["Коробка 1", "Коробка 2", "Коробка 3"]);
    expect(r.parentName).toBe("Shelf A");
  });

  test("case-insensitive match, preserves user casing in suggestion", () => {
    const r = computeSuggestion("коробка", [sib("1", "Коробка 1"), sib("2", "Коробка 2")], null);
    expect(r.suggestion?.name).toBe("коробка 3");
  });

  test("dash-separated dominant → suggestion uses dash", () => {
    const r = computeSuggestion("Box", [
      sib("1", "Box-1"),
      sib("2", "Box-2"),
      sib("3", "Box-3"),
    ], null);
    expect(r.suggestion?.name).toBe("Box-4");
    expect(r.suggestion?.separator).toBe("-");
  });

  test("mixed separators tied → tie-breaks to space", () => {
    const r = computeSuggestion("Box", [
      sib("1", "Box 1"),
      sib("2", "Box-2"),
    ], null);
    expect(r.suggestion?.separator).toBe(" ");
    expect(r.suggestion?.name).toBe("Box 3");
  });

  test("gap in numbering → suggests max+1, not the gap", () => {
    const r = computeSuggestion("Коробка", [
      sib("1", "Коробка 1"),
      sib("2", "Коробка 2"),
      sib("4", "Коробка 4"),
    ], null);
    expect(r.suggestion?.nextNumber).toBe(5);
    expect(r.suggestion?.name).toBe("Коробка 5");
  });

  test("non-matching siblings excluded from existing", () => {
    const r = computeSuggestion("Коробка", [
      sib("1", "Коробка 1"),
      sib("2", "Полка 1"),
      sib("3", "Коробка 2"),
    ], null);
    expect(r.existing.map(s => s.id)).toEqual(["1", "3"]);
  });

  test("sibling without trailing number is ignored", () => {
    const r = computeSuggestion("Коробка", [
      sib("1", "Коробка"),
      sib("2", "Коробка 1"),
    ], null);
    expect(r.suggestion?.nextNumber).toBe(2);
    expect(r.existing.map(s => s.name)).toEqual(["Коробка 1"]);
  });

  test("parentName flows through to result", () => {
    const r = computeSuggestion("Коробка", [sib("1", "Коробка 1")], "Гараж");
    expect(r.parentName).toBe("Гараж");
  });

  test("input with trailing whitespace is trimmed for matching", () => {
    const r = computeSuggestion("Коробка ", [sib("1", "Коробка 1")], null);
    expect(r.suggestion?.name).toBe("Коробка 2");
  });
});
