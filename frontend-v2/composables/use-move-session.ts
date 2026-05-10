import type { ItemSummary } from "~~/lib/api/types/data-contracts";

type Mode = "immediate" | "queue";

type DestinationLite = { id: string; name: string };

type UndoEntry = {
  itemId: string;
  itemName: string;
  prevLocationId: string | null;
  expiresAt: number;
};

const RECENT_LIMIT = 5;

export type MoveScanResult =
  | { kind: "moved"; item: ItemSummary }
  | { kind: "queued"; item: ItemSummary }
  | { kind: "already-here"; item: ItemSummary }
  | { kind: "no-destination" }
  | { kind: "not-found" }
  | { kind: "network-error"; retry: () => Promise<MoveScanResult> };

export type ApplyResult = { ok: number; failed: ItemSummary[] };

export function useMoveSession() {
  const api = useUserApi();

  const destination = ref<DestinationLite | null>(null);
  const mode = ref<Mode>("immediate");
  const queue = ref<ItemSummary[]>([]);
  const recent = ref<ItemSummary[]>([]);
  const undoEntry = ref<UndoEntry | null>(null);
  const applying = ref(false);
  const applyProgress = ref(0);

  function reset() {
    destination.value = null;
    mode.value = "immediate";
    queue.value = [];
    recent.value = [];
    undoEntry.value = null;
    applying.value = false;
    applyProgress.value = 0;
  }

  function setDestinationFromLocation(loc: { id: string; name: string }) {
    destination.value = { id: loc.id, name: loc.name };
  }

  function clearDestination() {
    destination.value = null;
  }

  function pushRecent(item: ItemSummary) {
    recent.value = [item, ...recent.value].slice(0, RECENT_LIMIT);
  }

  function pushQueue(item: ItemSummary) {
    if (queue.value.some(i => i.id === item.id)) return;
    queue.value = [item, ...queue.value];
  }

  function removeFromQueue(id: string) {
    queue.value = queue.value.filter(i => i.id !== id);
  }

  function clearQueue() {
    queue.value = [];
  }

  async function fetchItem(id: string): Promise<ItemSummary | null> {
    const resp = await api.items.get(id);
    if (!resp.data) return null;
    const it = resp.data;
    return {
      id: it.id,
      name: it.name,
      assetId: it.assetId,
      description: it.description,
      quantity: it.quantity,
      insured: it.insured,
      archived: it.archived,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
      purchasePrice: it.purchasePrice,
      soldTime: it.soldTime,
      tags: it.tags,
      imageId: it.imageId,
      thumbnailId: it.thumbnailId,
      location: it.location,
    };
  }

  async function scanItemId(id: string): Promise<MoveScanResult> {
    const item = await fetchItem(id);
    if (!item) return { kind: "not-found" };

    if (mode.value === "queue") {
      pushQueue(item);
      return { kind: "queued", item };
    }

    if (!destination.value) {
      return { kind: "no-destination" };
    }

    if (item.location?.id === destination.value.id) {
      return { kind: "already-here", item };
    }

    const prevLocId = item.location?.id ?? null;
    const destId = destination.value.id;
    try {
      const resp = await api.items.patch(item.id, { id: item.id, locationId: destId });
      if (resp.error) {
        return { kind: "network-error", retry: () => scanItemId(id) };
      }
      pushRecent(item);
      undoEntry.value = {
        itemId: item.id,
        itemName: item.name,
        prevLocationId: prevLocId,
        expiresAt: Date.now() + 5000,
      };
      return { kind: "moved", item };
    } catch {
      return { kind: "network-error", retry: () => scanItemId(id) };
    }
  }

  async function undoLast(): Promise<boolean> {
    const entry = undoEntry.value;
    if (!entry) return false;
    undoEntry.value = null;
    try {
      const resp = await api.items.patch(entry.itemId, {
        id: entry.itemId,
        locationId: entry.prevLocationId,
      });
      if (resp.error) return false;
      recent.value = recent.value.filter(i => i.id !== entry.itemId);
      return true;
    } catch {
      return false;
    }
  }

  async function applyQueue(): Promise<ApplyResult> {
    if (!destination.value || queue.value.length === 0) {
      return { ok: 0, failed: [] };
    }
    applying.value = true;
    applyProgress.value = 0;
    const failed: ItemSummary[] = [];
    let ok = 0;
    const destId = destination.value.id;
    const items = [...queue.value];
    for (const item of items) {
      try {
        const resp = await api.items.patch(item.id, { id: item.id, locationId: destId });
        if (resp.error) {
          failed.push(item);
        } else {
          ok++;
          removeFromQueue(item.id);
        }
      } catch {
        failed.push(item);
      }
      applyProgress.value++;
    }
    applying.value = false;
    return { ok, failed };
  }

  function preloadQueue(items: ItemSummary[], forceQueueMode = true) {
    queue.value = [...items];
    if (forceQueueMode) mode.value = "queue";
  }

  return {
    destination: readonly(destination),
    mode,
    queue: readonly(queue),
    recent: readonly(recent),
    undoEntry: readonly(undoEntry),
    applying: readonly(applying),
    applyProgress: readonly(applyProgress),
    setDestinationFromLocation,
    clearDestination,
    scanItemId,
    undoLast,
    applyQueue,
    removeFromQueue,
    clearQueue,
    preloadQueue,
    reset,
  };
}
