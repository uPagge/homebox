<script setup lang="ts">
import { MapPin, Plus } from "lucide-vue-next";

definePageMeta({ layout: "default" });

const { tree, itemCounts, loading, refresh } = useLocations();

const showCreate = ref(false);

onMounted(() => refresh());

function handleCreated() {
  showCreate.value = false;
  refresh();
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

    <!-- Tree -->
    <div v-else class="bg-card border border-border rounded-xl overflow-hidden py-1">
      <LocationTreeNode
        v-for="node in tree"
        :key="node.id"
        :node="node"
        :depth="0"
        :item-counts="itemCounts"
      />
    </div>

    <!-- Create sheet -->
    <LocationCreateSheet
      v-model:open="showCreate"
      @created="handleCreated"
    />
  </div>
</template>
