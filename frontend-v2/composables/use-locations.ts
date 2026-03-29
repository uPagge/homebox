// homebox/frontend-v2/composables/use-locations.ts
import type {
  TreeItem,
  LocationOutCount,
  LocationCreate,
  LocationOut,
  LocationUpdate,
} from "~~/lib/api/types/data-contracts";

export function useLocations() {
  const api = useUserApi();

  const tree = ref<TreeItem[]>([]);
  const locations = ref<LocationOutCount[]>([]);
  const loading = ref(false);

  // Map of location id → itemCount for badge display
  const itemCounts = computed(() => {
    const map = new Map<string, number>();
    for (const loc of locations.value) {
      map.set(loc.id, loc.itemCount);
    }
    return map;
  });

  async function refresh() {
    loading.value = true;
    try {
      const [treeResp, listResp] = await Promise.all([
        api.locations.getTree({ withItems: false }),
        api.locations.getAll({ filterChildren: false }),
      ]);
      if (treeResp.data) tree.value = treeResp.data;
      if (listResp.data) locations.value = listResp.data;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: LocationCreate): Promise<LocationOut | null> {
    const resp = await api.locations.create(data);
    if (resp.data) {
      await refresh();
      return resp.data;
    }
    return null;
  }

  async function update(id: string, data: LocationUpdate): Promise<LocationOut | null> {
    const resp = await api.locations.update(id, data);
    if (resp.data) {
      await refresh();
      return resp.data;
    }
    return null;
  }

  async function remove(id: string): Promise<boolean> {
    const resp = await api.locations.delete(id);
    if (!resp.error) {
      await refresh();
      return true;
    }
    return false;
  }

  return { tree, locations, itemCounts, loading, refresh, create, update, remove };
}
