<script setup lang="ts">
import { Tag, Plus, Search } from "lucide-vue-next";

definePageMeta({ layout: "default" });

const { labels, loading, refresh } = useLabels();

const showCreate = ref(false);
const searchQuery = ref("");

const filteredLabels = computed(() => {
  if (!searchQuery.value) return labels.value;
  const q = searchQuery.value.toLowerCase();
  return labels.value.filter(l => l.name.toLowerCase().includes(q));
});

// Item counts per label — fetch items count for each tag
const api = useUserApi();
const itemCounts = ref<Map<string, number>>(new Map());

async function fetchItemCounts() {
  const counts = new Map<string, number>();
  for (const label of labels.value) {
    const resp = await api.items.getAll({ tags: [label.id], pageSize: 1 });
    if (resp.data) {
      counts.set(label.id, resp.data.total);
    }
  }
  itemCounts.value = counts;
}

onMounted(async () => {
  await refresh();
  fetchItemCounts();
});

function handleCreated() {
  showCreate.value = false;
  refresh().then(() => fetchItemCounts());
}
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Метки</h1>
      <button
        class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        @click="showCreate = true"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>

    <!-- Search -->
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Поиск меток..."
        class="w-full pl-9 pr-4 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading && labels.length === 0" class="space-y-2">
      <Skeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loading && labels.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <Tag class="w-12 h-12 text-muted-foreground/50 mb-3" />
      <h3 class="text-sm font-medium">Нет меток</h3>
      <p class="text-xs text-muted-foreground mt-1">Создайте первую метку</p>
    </div>

    <!-- No search results -->
    <div
      v-else-if="filteredLabels.length === 0 && searchQuery"
      class="text-center py-8 text-sm text-muted-foreground"
    >
      Ничего не найдено по запросу «{{ searchQuery }}»
    </div>

    <!-- Labels list -->
    <div v-else class="space-y-2">
      <LabelCard
        v-for="label in filteredLabels"
        :key="label.id"
        :label="label"
        :item-count="itemCounts.get(label.id)"
      />
    </div>

    <!-- Create sheet -->
    <LabelCreateSheet
      v-model:open="showCreate"
      @created="handleCreated"
    />
  </div>
</template>
