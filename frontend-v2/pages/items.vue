<script setup lang="ts">
import { Search, LayoutGrid, List, Package } from "lucide-vue-next";
import { useDebounceFn } from "@vueuse/core";

definePageMeta({ layout: "default" });

const { items, total, totalPrice, loading, filters, fetchItems, setSearch, setPage, toggleLocation, toggleTag, clearFilters } = useItems();

const preferences = useViewPreferences();
const viewMode = computed({
  get: () => preferences.value.itemDisplayView,
  set: (v) => { preferences.value.itemDisplayView = v; },
});

// Debounced search
const searchInput = ref(filters.q);
const debouncedSearch = useDebounceFn((val: string) => {
  setSearch(val);
}, 200);

watch(searchInput, (val) => debouncedSearch(val));

// Quantity update via PATCH
const api = useUserApi();
async function handleQuantityUpdate(id: string, quantity: number) {
  await api.items.patch(id, { id, quantity });
  fetchItems();
}

// Total pages
const totalPages = computed(() => Math.ceil(total.value / filters.pageSize));

// Initial fetch
onMounted(() => fetchItems());
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">Вещи</h1>
        <p class="text-muted-foreground text-sm mt-0.5">
          {{ total }} шт.
          <span v-if="totalPrice"> &middot; {{ totalPrice.toFixed(2) }}</span>
        </p>
      </div>
      <div class="flex items-center gap-1">
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

    <!-- Search -->
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        v-model="searchInput"
        type="text"
        placeholder="Поиск вещей..."
        class="w-full pl-9 pr-4 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>

    <!-- Filters -->
    <FilterBar
      :selected-locations="filters.locations"
      :selected-tags="filters.tags"
      @toggle-location="toggleLocation"
      @toggle-tag="toggleTag"
      @clear="clearFilters"
    />

    <!-- Loading skeleton -->
    <div v-if="loading && items.length === 0" class="space-y-2">
      <Skeleton v-for="i in 5" :key="i" class="h-16 w-full rounded-lg" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loading && items.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <Package class="w-12 h-12 text-muted-foreground/50 mb-3" />
      <h3 class="text-sm font-medium">Ничего не найдено</h3>
      <p class="text-xs text-muted-foreground mt-1">
        {{ filters.q || filters.locations.length || filters.tags.length
          ? 'Попробуйте изменить параметры поиска'
          : 'Добавьте первую вещь' }}
      </p>
    </div>

    <!-- Grid view -->
    <div
      v-else-if="viewMode === 'card'"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
    >
      <ItemCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        @quantity-update="handleQuantityUpdate"
      />
    </div>

    <!-- List view -->
    <div v-else class="bg-card border border-border rounded-xl overflow-hidden">
      <ItemListRow
        v-for="item in items"
        :key="item.id"
        :item="item"
        @quantity-update="handleQuantityUpdate"
      />
    </div>

    <!-- Pagination -->
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
  </div>
</template>
