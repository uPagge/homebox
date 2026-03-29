import type { MaintenanceEntryWithDetails, MaintenanceFilterStatus } from "~~/lib/api/types/data-contracts";
import { MaintenanceFilterStatus as FilterStatus } from "~~/lib/api/types/data-contracts";

export function useMaintenance() {
  const api = useUserApi();

  const entries = ref<MaintenanceEntryWithDetails[]>([]);
  const loading = ref(false);
  const status = ref<MaintenanceFilterStatus>(FilterStatus.MaintenanceFilterStatusBoth);

  async function refresh() {
    loading.value = true;
    try {
      const resp = await api.maintenance.getAll({ status: status.value });
      if (resp.data) {
        entries.value = resp.data;
      }
    } finally {
      loading.value = false;
    }
  }

  function setStatus(s: MaintenanceFilterStatus) {
    status.value = s;
    refresh();
  }

  return { entries, loading, status, refresh, setStatus };
}
