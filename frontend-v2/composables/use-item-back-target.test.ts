import { describe, expect, test } from "vitest";
import { resolveItemBackTarget } from "./use-item-back-target";

const namedTree = (map: Record<string, string>) => (id: string) => map[id] ?? null;
const emptyTree = () => null;

describe("resolveItemBackTarget", () => {
  test("no from → kind:back, fallback label", () => {
    expect(resolveItemBackTarget(undefined, emptyTree)).toEqual({
      kind: "back",
      label: "Назад",
    });
  });

  test("empty from → kind:back (treated as no origin)", () => {
    expect(resolveItemBackTarget("", emptyTree)).toEqual({
      kind: "back",
      label: "Назад",
    });
  });

  test("from present, name unknown → kind:navigate with fallback label", () => {
    expect(resolveItemBackTarget("A", emptyTree)).toEqual({
      kind: "navigate",
      label: "Назад",
      to: "/locations/A",
    });
  });

  test("from present, name known → kind:navigate with name as label", () => {
    const getName = namedTree({ A: "Кухня" });
    expect(resolveItemBackTarget("A", getName)).toEqual({
      kind: "navigate",
      label: "Кухня",
      to: "/locations/A",
    });
  });

  test("from present, name is empty string → fallback label, still navigate", () => {
    const getName = (id: string) => (id === "A" ? "" : null);
    expect(resolveItemBackTarget("A", getName)).toEqual({
      kind: "navigate",
      label: "Назад",
      to: "/locations/A",
    });
  });

  test("non-ascii id (uuid-like) → composed path is correct", () => {
    const getName = namedTree({ "abc-123": "Гараж" });
    expect(resolveItemBackTarget("abc-123", getName)).toEqual({
      kind: "navigate",
      label: "Гараж",
      to: "/locations/abc-123",
    });
  });
});
