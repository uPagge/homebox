import type { ItemOut, ItemUpdate } from "~~/lib/api/types/data-contracts";

export function itemOutToItemUpdate(
  out: ItemOut,
  overrides: Partial<ItemUpdate>,
): ItemUpdate {
  const base: ItemUpdate = {
    id: out.id,
    name: out.name,
    description: out.description,
    quantity: out.quantity,
    archived: out.archived,
    assetId: out.assetId,
    insured: out.insured,
    lifetimeWarranty: out.lifetimeWarranty,
    locationId: out.location?.id ?? "",
    manufacturer: out.manufacturer,
    modelNumber: out.modelNumber,
    notes: out.notes,
    parentId: out.parent?.id ?? null,
    purchaseFrom: out.purchaseFrom,
    purchasePrice: out.purchasePrice,
    purchaseTime: out.purchaseTime,
    serialNumber: out.serialNumber,
    soldNotes: out.soldNotes,
    soldPrice: out.soldPrice,
    soldTime: out.soldTime,
    soldTo: out.soldTo,
    syncChildItemsLocations: out.syncChildItemsLocations,
    tagIds: out.tags.map(t => t.id),
    warrantyDetails: out.warrantyDetails,
    warrantyExpires: out.warrantyExpires,
    fields: out.fields,
  };
  return { ...base, ...overrides };
}
