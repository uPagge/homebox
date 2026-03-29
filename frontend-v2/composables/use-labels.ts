// frontend-v2/composables/use-labels.ts
import type { TagOut, TagCreate } from "~~/lib/api/types/data-contracts";

export function useLabels() {
  const api = useUserApi();

  const labels = ref<TagOut[]>([]);
  const loading = ref(false);

  async function refresh() {
    loading.value = true;
    try {
      const resp = await api.tags.getAll();
      if (resp.data) {
        labels.value = resp.data.sort((a, b) => a.name.localeCompare(b.name));
      }
    } finally {
      loading.value = false;
    }
  }

  async function create(data: TagCreate): Promise<TagOut | null> {
    const resp = await api.tags.create(data);
    if (resp.data) {
      await refresh();
      return resp.data;
    }
    return null;
  }

  async function update(id: string, data: TagCreate): Promise<TagOut | null> {
    const resp = await api.tags.update(id, data);
    if (resp.data) {
      await refresh();
      return resp.data;
    }
    return null;
  }

  async function remove(id: string): Promise<boolean> {
    const resp = await api.tags.delete(id);
    if (!resp.error) {
      await refresh();
      return true;
    }
    return false;
  }

  return { labels, loading, refresh, create, update, remove };
}
