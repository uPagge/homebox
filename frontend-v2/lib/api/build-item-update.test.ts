import { describe, it, expect } from "vitest";
import type { ItemOut, ItemUpdate } from "~~/lib/api/types/data-contracts";
import { buildItemUpdate } from "./build-item-update";

const NOW = "2026-01-01T00:00:00Z";

function fullItem(overrides: Partial<ItemOut> = {}): ItemOut {
  return {
    id: "item-1",
    name: "Thing",
    description: "a thing",
    quantity: 3,
    insured: true,
    archived: false,
    assetId: "0",
    manufacturer: "Acme",
    modelNumber: "M1",
    serialNumber: "SN-001",
    notes: "n",
    purchaseFrom: "Shop",
    purchasePrice: 9.99,
    purchaseTime: NOW,
    warrantyExpires: NOW,
    warrantyDetails: "1y",
    lifetimeWarranty: false,
    soldTime: NOW,
    soldTo: "",
    soldPrice: 0,
    soldNotes: "",
    syncChildItemsLocations: false,
    createdAt: NOW,
    updatedAt: NOW,
    attachments: [],
    fields: [],
    tags: [
      { id: "tag-a", name: "a", color: "", description: "", createdAt: NOW, updatedAt: NOW },
      { id: "tag-b", name: "b", color: "", description: "", createdAt: NOW, updatedAt: NOW },
    ],
    location: { id: "loc-1", name: "Home", description: "", createdAt: NOW, updatedAt: NOW },
    parent: {
      id: "parent-1",
      name: "Parent",
      description: "",
      quantity: 1,
      insured: false,
      archived: false,
      assetId: "0",
      purchasePrice: 0,
      soldTime: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      tags: [],
    },
    ...overrides,
  };
}

describe("buildItemUpdate", () => {
  it("populates every required ItemUpdate field from a fully-loaded ItemOut", () => {
    const item = fullItem();
    const result = buildItemUpdate(item);
    const requiredKeys: Array<keyof ItemUpdate> = [
      "id", "name", "description", "locationId", "tagIds", "quantity",
      "manufacturer", "modelNumber", "serialNumber", "notes",
      "purchaseFrom", "purchaseTime", "warrantyExpires", "warrantyDetails",
      "lifetimeWarranty", "insured", "fields", "archived", "assetId",
      "soldTime", "soldTo", "soldNotes", "syncChildItemsLocations",
    ];
    for (const key of requiredKeys) {
      expect(result[key], `missing key: ${key}`).not.toBeUndefined();
    }
  });

  it("maps item.location.id -> locationId", () => {
    const item = fullItem();
    expect(buildItemUpdate(item).locationId).toBe("loc-1");
  });

  it("maps item.parent.id -> parentId", () => {
    const item = fullItem();
    expect(buildItemUpdate(item).parentId).toBe("parent-1");
  });

  it("maps item.tags[].id -> tagIds", () => {
    const item = fullItem();
    expect(buildItemUpdate(item).tagIds).toEqual(["tag-a", "tag-b"]);
  });

  it("falls back to null when item.parent is missing (regression: never silently drops parentId)", () => {
    const item = fullItem({ parent: null });
    expect(buildItemUpdate(item).parentId).toBeNull();
  });

  it("falls back to empty string when item.location is missing", () => {
    const item = fullItem({ location: null });
    expect(buildItemUpdate(item).locationId).toBe("");
  });

  it("applies overrides.parentId = null to clear parent", () => {
    const item = fullItem();
    expect(buildItemUpdate(item, { parentId: null }).parentId).toBeNull();
  });

  it("applies overrides.tagIds to replace tags", () => {
    const item = fullItem();
    expect(buildItemUpdate(item, { tagIds: ["other"] }).tagIds).toEqual(["other"]);
  });

  it("ignores undefined values in overrides (does not clobber base mapping)", () => {
    const item = fullItem();
    const result = buildItemUpdate(item, { name: undefined, parentId: undefined });
    expect(result.name).toBe("Thing");
    expect(result.parentId).toBe("parent-1");
  });

  it("throws when overrides.parentId equals item.id (self-parent guard)", () => {
    const item = fullItem();
    expect(() => buildItemUpdate(item, { parentId: item.id })).toThrow(/own parent/);
  });

  it("does not treat overrides.parentId = null as self-parent attempt", () => {
    const item = fullItem();
    expect(() => buildItemUpdate(item, { parentId: null })).not.toThrow();
  });
});
