import { describe, it, expect } from "vitest";
import { decideScanPickAction } from "./decide-scan-pick-action";

const LOC_UUID = "11111111-1111-1111-1111-111111111111";
const ITEM_UUID = "22222222-2222-2222-2222-222222222222";

describe("decideScanPickAction", () => {
  it("picks a location when accepts=['location']", () => {
    expect(
      decideScanPickAction(`https://h.local/locations/${LOC_UUID}`, ["location"]),
    ).toEqual({ type: "pick", target: { kind: "location", id: LOC_UUID } });
  });

  it("picks an item when accepts=['item']", () => {
    expect(
      decideScanPickAction(`https://h.local/items/${ITEM_UUID}`, ["item"]),
    ).toEqual({ type: "pick", target: { kind: "item", id: ITEM_UUID } });
  });

  it("reports mismatch when location-only field gets an item QR", () => {
    expect(
      decideScanPickAction(`https://h.local/items/${ITEM_UUID}`, ["location"]),
    ).toEqual({ type: "mismatch", expected: "location" });
  });

  it("reports mismatch when item-only field gets a location QR", () => {
    expect(
      decideScanPickAction(`https://h.local/locations/${LOC_UUID}`, ["item"]),
    ).toEqual({ type: "mismatch", expected: "item" });
  });

  it("picks either kind when accepts=['location','item']", () => {
    expect(
      decideScanPickAction(`https://h.local/items/${ITEM_UUID}`, ["location", "item"]),
    ).toEqual({ type: "pick", target: { kind: "item", id: ITEM_UUID } });
    expect(
      decideScanPickAction(`https://h.local/locations/${LOC_UUID}`, ["item", "location"]),
    ).toEqual({ type: "pick", target: { kind: "location", id: LOC_UUID } });
  });

  it("reports not_homebox for non-URL text", () => {
    expect(decideScanPickAction("just a sticky note", ["location"]))
      .toEqual({ type: "not_homebox" });
  });

  it("reports not_homebox for external URL", () => {
    expect(decideScanPickAction("https://example.com/", ["location"]))
      .toEqual({ type: "not_homebox" });
  });

  it("reports not_homebox for a label URL even when accepts is broad", () => {
    expect(
      decideScanPickAction(`https://h.local/labels/${LOC_UUID}`, ["location", "item"]),
    ).toEqual({ type: "not_homebox" });
  });

  it("accepts legacy singular paths", () => {
    expect(
      decideScanPickAction(`https://h.local/location/${LOC_UUID}`, ["location"]),
    ).toEqual({ type: "pick", target: { kind: "location", id: LOC_UUID } });
    expect(
      decideScanPickAction(`https://h.local/item/${ITEM_UUID}`, ["item"]),
    ).toEqual({ type: "pick", target: { kind: "item", id: ITEM_UUID } });
  });
});
