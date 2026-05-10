import { describe, expect, test } from "vitest";
import { parseNumberedName } from "./use-location-name-suggest";

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
