import type { ItemOut, ItemUpdate } from "~~/lib/api/types/data-contracts";

export function useSplitItem() {
  const api = useUserApi();
  const processing = ref(false);

  async function split(params: {
    sourceId: string;
    sourceQuantity: number;
    extractQuantity: number;
    newLocationId: string;
    newName: string;
  }): Promise<{ newItemId: string }> {
    if (params.extractQuantity < 1 || params.extractQuantity >= params.sourceQuantity) {
      throw new Error("Некорректное количество для выделения");
    }

    processing.value = true;
    let newId: string | null = null;
    try {
      const dupResp = await api.items.duplicate(params.sourceId, {
        copyAttachments: true,
        copyCustomFields: true,
      });
      if (dupResp.error || !dupResp.data) {
        throw new Error("Не удалось создать копию");
      }
      newId = dupResp.data.id;

      const updatePayload = itemOutToItemUpdate(dupResp.data, {
        id: newId,
        name: params.newName,
        locationId: params.newLocationId,
        quantity: params.extractQuantity,
        serialNumber: "",
        parentId: null,
      });
      const updateResp = await api.items.update(newId, updatePayload);
      if (updateResp.error) {
        throw new Error("Не удалось обновить новый item");
      }

      const patchResp = await api.items.patch(params.sourceId, {
        id: params.sourceId,
        quantity: params.sourceQuantity - params.extractQuantity,
      });
      if (patchResp.error) {
        throw new Error("Не удалось обновить источник");
      }

      return { newItemId: newId };
    } catch (e) {
      if (newId) {
        try {
          await api.items.delete(newId);
        } catch (rollbackErr) {
          console.error("Split rollback failed: orphan item", newId, rollbackErr);
        }
      }
      throw e;
    } finally {
      processing.value = false;
    }
  }

  return { processing, split };
}

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
