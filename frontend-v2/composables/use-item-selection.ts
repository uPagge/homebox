import type { Ref } from "vue";
import type { ItemSummary } from "~~/lib/api/types/data-contracts";

export function useItemSelection(items: Ref<ItemSummary[]>) {
  const selectionMode = ref(false);
  const selectedIds = ref<Set<string>>(new Set());

  const selectedItems = computed(() =>
    items.value.filter(i => selectedIds.value.has(i.id))
  );

  function toggleSelection(id: string) {
    const s = new Set(selectedIds.value);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    selectedIds.value = s;
  }

  function toggleSelectAll() {
    if (selectedIds.value.size === items.value.length) {
      selectedIds.value = new Set();
    } else {
      selectedIds.value = new Set(items.value.map(i => i.id));
    }
  }

  function clearSelection() {
    selectedIds.value = new Set();
  }

  function exitSelectionMode() {
    selectionMode.value = false;
    selectedIds.value = new Set();
  }

  const showBatchLocation = ref(false);
  const showBatchTagAdd = ref(false);
  const showBatchTagRemove = ref(false);
  const showBatchDelete = ref(false);
  const showBatchDuplicate = ref(false);
  const showBatchArchive = ref(false);

  const batchArchiveLabel = computed(() =>
    selectedItems.value.some(i => !i.archived) ? "Архивировать" : "Вернуть из архива"
  );

  const anyBatchSheetOpen = computed(() =>
    showBatchLocation.value ||
    showBatchTagAdd.value ||
    showBatchTagRemove.value ||
    showBatchDelete.value ||
    showBatchDuplicate.value ||
    showBatchArchive.value
  );

  onMounted(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectionMode.value) {
        exitSelectionMode();
      }
    };
    document.addEventListener("keydown", handler);
    onUnmounted(() => document.removeEventListener("keydown", handler));
  });

  return {
    selectionMode,
    selectedIds,
    selectedItems,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    exitSelectionMode,
    showBatchLocation,
    showBatchTagAdd,
    showBatchTagRemove,
    showBatchDelete,
    showBatchDuplicate,
    showBatchArchive,
    batchArchiveLabel,
    anyBatchSheetOpen,
  };
}
