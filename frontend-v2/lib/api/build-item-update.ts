import type { ItemOut, ItemUpdate } from "~~/lib/api/types/data-contracts";

export function buildItemUpdate(item: ItemOut, overrides?: Partial<ItemUpdate>): ItemUpdate {
  if (overrides?.parentId !== undefined && overrides.parentId === item.id) {
    throw new Error("buildItemUpdate: cannot make item its own parent");
  }
  const base: ItemUpdate = {
    id: item.id,
    name: item.name,
    description: item.description,
    locationId: item.location?.id ?? "",
    parentId: item.parent?.id ?? null,
    tagIds: item.tags.map(t => t.id),
    quantity: item.quantity,
    manufacturer: item.manufacturer,
    modelNumber: item.modelNumber,
    serialNumber: item.serialNumber,
    notes: item.notes,
    purchaseFrom: item.purchaseFrom,
    purchasePrice: item.purchasePrice,
    purchaseTime: item.purchaseTime,
    warrantyExpires: item.warrantyExpires,
    warrantyDetails: item.warrantyDetails,
    lifetimeWarranty: item.lifetimeWarranty,
    insured: item.insured,
    fields: item.fields,
    archived: item.archived,
    assetId: item.assetId,
    soldTime: item.soldTime,
    soldTo: item.soldTo,
    soldPrice: item.soldPrice,
    soldNotes: item.soldNotes,
    syncChildItemsLocations: item.syncChildItemsLocations,
  };
  if (!overrides) return base;
  for (const [key, value] of Object.entries(overrides) as [keyof ItemUpdate, ItemUpdate[keyof ItemUpdate]][]) {
    if (value === undefined) continue;
    (base[key] as unknown) = value;
  }
  return base;
}
