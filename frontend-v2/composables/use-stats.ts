import type {
  GroupStatistics,
  TotalsByOrganizer,
} from "~~/lib/api/types/data-contracts";

export function useStats() {
  const api = useUserApi();

  const stats = ref<GroupStatistics | null>(null);
  const locationBreakdown = ref<TotalsByOrganizer[]>([]);
  const tagBreakdown = ref<TotalsByOrganizer[]>([]);
  const loading = ref(false);

  async function refresh() {
    loading.value = true;
    try {
      const [groupResp, locResp, tagResp] = await Promise.all([
        api.stats.group(),
        api.stats.locations(),
        api.stats.tags(),
      ]);
      if (groupResp.data) stats.value = groupResp.data;
      if (locResp.data) locationBreakdown.value = locResp.data;
      if (tagResp.data) tagBreakdown.value = tagResp.data;
    } finally {
      loading.value = false;
    }
  }

  return { stats, locationBreakdown, tagBreakdown, loading, refresh };
}
