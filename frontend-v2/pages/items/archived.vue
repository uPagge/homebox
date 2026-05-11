<script setup lang="ts">
import { Search, LayoutGrid, List, Archive } from "lucide-vue-next";
import { useDebounceFn } from "@vueuse/core";

definePageMeta({ layout: "default" });

const {
  items, total, totalPrice, loading, filters,
  fetchItems, setSearch, setPage, toggleLocation, toggleTag, clearFilters,
} = useItems();

onMounted(() => {
  filters.archivedOnly = true;
  filters.includeArchived = false;
  fetchItems();
});

const preferences = useViewPreferences();
const viewMode = computed({
  get: () => preferences.value.itemDisplayView,
  set: (v) => { preferences.value.itemDisplayView = v; },
});

const selectionMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());

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

function exitSelectionMode() {
  selectionMode.value = false;
  selectedIds.value = new Set();
}

watch([() => filters.page, () => filters.q, () => filters.locations, () => filters.tags], () => {
  selectedIds.value = new Set();
});

onMounted(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape" && selectionMode.value) {
      exitSelectionMode();
    }
  };
  document.addEventListener("keydown", handler);
  onUnmounted(() => document.removeEventListener("keydown", handler));
});

const selectedItems = computed(() =>
  items.value.filter(i => selectedIds.value.has(i.id))
);

const showBatchArchive = ref(false);
const showBatchDelete = ref(false);

const searchInput = ref(filters.q);
const debouncedSearch = useDebounceFn((val: string) => {
  setSearch(val);
}, 200);

watch(searchInput, (val) => debouncedSearch(val));

const totalPages = computed(() => Math.ceil(total.value / filters.pageSize));
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Archive class="w-5 h-5 text-muted-foreground" />
        <div>
          <h1 class="text-xl font-semibold">Архив</h1>
          <p class="text-muted-foreground text-sm mt-0.5">
            {{ total }} шт.
            <span v-if="totalPrice"> &middot; {{ totalPrice.toFixed(2) }}</span>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button
          class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          :class="selectionMode
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent'"
          @click="selectionMode ? exitSelectionMode() : (selectionMode = true)"
        >
          {{ selectionMode ? `Выбрано: ${selectedIds.size}` : 'Выбрать' }}
        </button>
        <button
          v-if="selectionMode"
          class="px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors"
          @click="toggleSelectAll"
        >
          {{ selectedIds.size === items.length ? 'Снять все' : 'Все' }}
        </button>
        <div class="w-px h-5 bg-border mx-1" />
        <button
          class="p-2 rounded-md transition-colors"
          :class="viewMode === 'card' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'"
          @click="viewMode = 'card'"
        >
          <LayoutGrid class="w-4 h-4" />
        </button>
        <button
          class="p-2 rounded-md transition-colors"
          :class="viewMode === 'table' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'"
          @click="viewMode = 'table'"
        >
          <List class="w-4 h-4" />
        </button>
      </div>
    </div>

    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        v-model="searchInput"
        type="text"
        placeholder="Поиск в архиве..."
        class="w-full pl-9 pr-4 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>

    <FilterBar
      :selected-locations="filters.locations"
      :selected-tags="filters.tags"
      @toggle-location="toggleLocation"
      @toggle-tag="toggleTag"
      @clear="clearFilters"
    />

    <div v-if="loading && items.length === 0" class="space-y-2">
      <Skeleton v-for="i in 5" :key="i" class="h-16 w-full rounded-lg" />
    </div>

    <div
      v-else-if="!loading && items.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <Archive class="w-12 h-12 text-muted-foreground/50 mb-3" />
      <h3 class="text-sm font-medium">Архив пуст</h3>
      <p class="text-xs text-muted-foreground mt-1">Здесь будут вещи, отправленные в архив.</p>
    </div>

    <div
      v-else-if="viewMode === 'card'"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
    >
      <ItemCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        :selection-mode="selectionMode"
        :selected="selectedIds.has(item.id)"
        @toggle-select="toggleSelection"
      />
    </div>

    <div v-else class="bg-card border border-border rounded-xl overflow-hidden">
      <ItemListRow
        v-for="item in items"
        :key="item.id"
        :item="item"
        :selection-mode="selectionMode"
        :selected="selectedIds.has(item.id)"
        @toggle-select="toggleSelection"
      />
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 pt-2">
      <button
        class="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-30 transition-colors"
        :disabled="filters.page <= 1"
        @click="setPage(filters.page - 1)"
      >
        Назад
      </button>
      <span class="text-sm text-muted-foreground tabular-nums">
        {{ filters.page }} / {{ totalPages }}
      </span>
      <button
        class="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-30 transition-colors"
        :disabled="filters.page >= totalPages"
        @click="setPage(filters.page + 1)"
      >
        Вперёд
      </button>
    </div>

    <SelectionBar
      v-if="selectionMode && selectedIds.size > 0"
      :count="selectedIds.size"
      archive-label="Вернуть из архива"
      @change-location="() => {}"
      @add-tags="() => {}"
      @remove-tags="() => {}"
      @duplicate="() => {}"
      @archive="showBatchArchive = true"
      @delete="showBatchDelete = true"
    />

    <BatchArchiveSheet
      :open="showBatchArchive"
      :items="selectedItems"
      @update:open="showBatchArchive = $event"
      @done="fetchItems(); exitSelectionMode()"
    />
    <BatchDeleteSheet
      :open="showBatchDelete"
      :items="selectedItems"
      @update:open="showBatchDelete = $event"
      @done="fetchItems(); exitSelectionMode()"
    />
  </div>
</template>
