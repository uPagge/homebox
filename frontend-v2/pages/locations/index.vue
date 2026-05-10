<script setup lang="ts">
import { MapPin, Plus, Search } from "lucide-vue-next";
import type { TreeItem } from "~~/lib/api/types/data-contracts";

definePageMeta({ layout: "default" });

const { tree, itemCounts, loading, refresh } = useLocations();

const showCreate = ref(false);
const searchQuery = ref("");

// Recursively filter tree: keep node if it or any descendant matches
function filterTree(nodes: TreeItem[], query: string): TreeItem[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  return nodes
    .map((node) => {
      const childrenMatch = filterTree(node.children || [], query);
      const selfMatch = node.name.toLowerCase().includes(q);
      if (selfMatch || childrenMatch.length > 0) {
        return { ...node, children: childrenMatch };
      }
      return null;
    })
    .filter((n): n is TreeItem => n !== null);
}

const filteredTree = computed(() => filterTree(tree.value, searchQuery.value));

onMounted(() => refresh());

function handleCreated(id: string) {
  showCreate.value = false;
  navigateTo(`/locations/${id}`);
}
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">Локации</h1>
      </div>
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
        placeholder="Поиск локаций..."
        class="w-full pl-9 pr-4 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading && tree.length === 0" class="space-y-2">
      <Skeleton v-for="i in 6" :key="i" class="h-10 w-full rounded-lg" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loading && tree.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <MapPin class="w-12 h-12 text-muted-foreground/50 mb-3" />
      <h3 class="text-sm font-medium">Нет локаций</h3>
      <p class="text-xs text-muted-foreground mt-1">Создайте первую локацию</p>
    </div>

    <!-- No search results -->
    <div
      v-else-if="filteredTree.length === 0 && searchQuery"
      class="text-center py-8 text-sm text-muted-foreground"
    >
      Ничего не найдено по запросу «{{ searchQuery }}»
    </div>

    <!-- Tree -->
    <div v-else class="bg-card border border-border rounded-xl overflow-hidden py-1">
      <LocationTreeNode
        v-for="node in filteredTree"
        :key="node.id"
        :node="node"
        :depth="0"
        :item-counts="itemCounts"
        :force-expand="!!searchQuery"
      />
    </div>

    <!-- Create sheet -->
    <LocationCreateSheet
      v-model:open="showCreate"
      @created="handleCreated"
    />
  </div>
</template>
