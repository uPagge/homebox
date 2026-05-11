import { describe, expect, test } from "vitest";
import { itemOutToItemUpdate } from "./use-split-item";
import type { ItemOut } from "~~/lib/api/types/data-contracts";

function makeItemOut(overrides: Partial<ItemOut> = {}): ItemOut {
  return {
    id: "src-id",
    name: "Source",
    description: "",
    quantity: 10,
    archived: false,
    assetId: "0",
    attachments: [],
    fields: [],
    insured: false,
    lifetimeWarranty: false,
    location: { id: "loc-1", name: "L1" } as ItemOut["location"],
    manufacturer: "",
    modelNumber: "",
    notes: "",
    purchaseFrom: "",
    purchasePrice: 0,
    purchaseTime: "0001-01-01T00:00:00Z",
    serialNumber: "ABC",
    soldNotes: "",
    soldPrice: 0,
    soldTime: "0001-01-01T00:00:00Z",
    soldTo: "",
    syncChildItemsLocations: false,
    tags: [
      { id: "t-1", name: "tag1", description: "", color: "" } as ItemOut["tags"][number],
      { id: "t-2", name: "tag2", description: "", color: "" } as ItemOut["tags"][number],
    ],
    warrantyDetails: "",
    warrantyExpires: "0001-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    parent: { id: "p-1" } as ItemOut["parent"],
    ...overrides,
  };
}

describe("itemOutToItemUpdate", () => {
  test("converts nested objects to ids", () => {
    const out = makeItemOut();
    const upd = itemOutToItemUpdate(out, {});
    expect(upd.locationId).toBe("loc-1");
    expect(upd.parentId).toBe("p-1");
    expect(upd.tagIds).toEqual(["t-1", "t-2"]);
  });

  test("applies overrides over converted fields", () => {
    const out = makeItemOut();
    const upd = itemOutToItemUpdate(out, {
      name: "Renamed",
      locationId: "loc-new",
      quantity: 3,
      serialNumber: "",
      parentId: null,
    });
    expect(upd.name).toBe("Renamed");
    expect(upd.locationId).toBe("loc-new");
    expect(upd.quantity).toBe(3);
    expect(upd.serialNumber).toBe("");
    expect(upd.parentId).toBeNull();
  });

  test("handles missing location (locationId becomes empty string)", () => {
    const out = makeItemOut({ location: null });
    const upd = itemOutToItemUpdate(out, {});
    expect(upd.locationId).toBe("");
  });

  test("handles missing parent (parentId becomes null)", () => {
    const out = makeItemOut({ parent: null });
    const upd = itemOutToItemUpdate(out, {});
    expect(upd.parentId).toBeNull();
  });

  test("preserves primitive fields verbatim", () => {
    const out = makeItemOut({ manufacturer: "ACME", purchasePrice: 12.5 });
    const upd = itemOutToItemUpdate(out, {});
    expect(upd.manufacturer).toBe("ACME");
    expect(upd.purchasePrice).toBe(12.5);
  });
});
