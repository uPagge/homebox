import { describe, expect, test } from "vitest";
import { resolveItemBackTarget } from "./use-item-back-target";

const namedTree = (map: Record<string, string>) => (id: string) => map[id] ?? null;
const emptyTree = () => null;

describe("resolveItemBackTarget", () => {
  test("no from → fallback label, null target", () => {
    expect(resolveItemBackTarget(undefined, emptyTree)).toEqual({
      label: "Назад",
      to: null,
    });
  });

  test("empty from → same as undefined", () => {
    expect(resolveItemBackTarget("", emptyTree)).toEqual({
      label: "Назад",
      to: null,
    });
  });

  test("from present, name unknown → fallback label, target by id", () => {
    expect(resolveItemBackTarget("A", emptyTree)).toEqual({
      label: "Назад",
      to: "/locations/A",
    });
  });

  test("from present, name known → location name as label", () => {
    const getName = namedTree({ A: "Кухня" });
    expect(resolveItemBackTarget("A", getName)).toEqual({
      label: "Кухня",
      to: "/locations/A",
    });
  });

  test("from present with non-ascii id (uuid-like) → composed path is correct", () => {
    const getName = namedTree({ "abc-123": "Гараж" });
    expect(resolveItemBackTarget("abc-123", getName)).toEqual({
      label: "Гараж",
      to: "/locations/abc-123",
    });
  });
});
