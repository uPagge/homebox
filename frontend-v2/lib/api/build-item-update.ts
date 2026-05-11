import type { ItemOut, ItemUpdate } from "~~/lib/api/types/data-contracts";

export function buildItemUpdate(item: ItemOut, overrides?: Partial<ItemUpdate>): ItemUpdate {
  return {
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
    ...overrides,
  };
}
