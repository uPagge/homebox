// homebox/frontend-v2/composables/use-items.ts
import type { ItemSummary } from "~~/lib/api/types/data-contracts";
import type { ItemsQuery } from "~~/lib/api/classes/items";
import type { ItemSummaryPaginationResult } from "~~/lib/api/types/non-generated";

export interface ItemFilters {
  q: string;
  locations: string[];
  tags: string[];
  page: number;
  pageSize: number;
  orderBy: string;
  includeArchived: boolean;
  archivedOnly: boolean;
}

const defaultFilters: ItemFilters = {
  q: "",
  locations: [],
  tags: [],
  page: 1,
  pageSize: 25,
  orderBy: "name",
  includeArchived: false,
  archivedOnly: false,
};

export function useItems() {
  const api = useUserApi();
  const route = useRoute();
  const router = useRouter();

  const items = ref<ItemSummary[]>([]);
  const total = ref(0);
  const totalPrice = ref(0);
  const loading = ref(false);

  const filters = reactive<ItemFilters>({ ...defaultFilters });

  // Sync filters FROM URL on init
  function syncFromUrl() {
    const q = route.query;
    if (q.q) filters.q = String(q.q);
    if (q.locations) filters.locations = String(q.locations).split(",");
    if (q.tags) filters.tags = String(q.tags).split(",");
    if (q.page) filters.page = Number(q.page);
    if (q.pageSize) filters.pageSize = Number(q.pageSize);
    if (q.orderBy) filters.orderBy = String(q.orderBy);
  }

  // Sync filters TO URL
  function syncToUrl() {
    const query: Record<string, string> = {};
    if (filters.q) query.q = filters.q;
    if (filters.locations.length) query.locations = filters.locations.join(",");
    if (filters.tags.length) query.tags = filters.tags.join(",");
    if (filters.page > 1) query.page = String(filters.page);
    if (filters.pageSize !== 25) query.pageSize = String(filters.pageSize);
    if (filters.orderBy !== "name") query.orderBy = filters.orderBy;
    router.replace({ query });
  }

  async function fetchItems() {
    loading.value = true;
    try {
      const q: ItemsQuery = {
        page: filters.page,
        pageSize: filters.pageSize,
        orderBy: filters.orderBy,
      };
      if (filters.q) q.q = filters.q;
      if (filters.locations.length) q.locations = filters.locations;
      if (filters.tags.length) q.tags = filters.tags;
      if (filters.archivedOnly) {
        q.archivedOnly = true;
      } else if (filters.includeArchived) {
        q.includeArchived = true;
      }

      const resp = await api.items.getAll(q);
      if (resp.data) {
        items.value = resp.data.items;
        total.value = resp.data.total;
        totalPrice.value = resp.data.totalPrice ?? 0;
      }
    } finally {
      loading.value = false;
    }
  }

  function setSearch(q: string) {
    filters.q = q;
    filters.page = 1;
    syncToUrl();
    fetchItems();
  }

  function setPage(page: number) {
    filters.page = page;
    syncToUrl();
    fetchItems();
  }

  function toggleLocation(id: string) {
    const idx = filters.locations.indexOf(id);
    if (idx >= 0) filters.locations.splice(idx, 1);
    else filters.locations.push(id);
    filters.page = 1;
    syncToUrl();
    fetchItems();
  }

  function toggleTag(id: string) {
    const idx = filters.tags.indexOf(id);
    if (idx >= 0) filters.tags.splice(idx, 1);
    else filters.tags.push(id);
    filters.page = 1;
    syncToUrl();
    fetchItems();
  }

  function clearFilters() {
    Object.assign(filters, { ...defaultFilters });
    syncToUrl();
    fetchItems();
  }

  function setIncludeArchived(value: boolean) {
    filters.includeArchived = value;
    filters.page = 1;
    syncToUrl();
    fetchItems();
  }

  function setArchivedOnly(value: boolean) {
    filters.archivedOnly = value;
    filters.page = 1;
    fetchItems();
  }

  // Initialize
  syncFromUrl();

  return {
    items,
    total,
    totalPrice,
    loading,
    filters,
    fetchItems,
    setSearch,
    setPage,
    toggleLocation,
    toggleTag,
    clearFilters,
    setIncludeArchived,
    setArchivedOnly,
  };
}
