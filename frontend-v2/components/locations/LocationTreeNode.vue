<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import type { TreeItem } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  node: TreeItem;
  depth: number;
  itemCounts: Map<string, number>;
  forceExpand?: boolean;
}>();

const expanded = ref(false);
const isExpanded = computed(() => props.forceExpand || expanded.value);
const hasChildren = computed(() => props.node.children && props.node.children.length > 0);
const count = computed(() => props.itemCounts.get(props.node.id) ?? 0);
</script>

<template>
  <div>
    <div
      class="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors group"
      :style="{ paddingLeft: `${depth * 16 + 12}px` }"
    >
      <!-- Expand/collapse toggle -->
      <button
        v-if="hasChildren"
        class="w-5 h-5 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-transform"
        :class="isExpanded ? 'rotate-90' : ''"
        @click="expanded = !expanded"
      >
        <ChevronRight class="w-4 h-4" />
      </button>
      <span v-else class="w-5 shrink-0" />

      <!-- Location name (link) -->
      <NuxtLink
        :to="`/locations/${node.id}`"
        class="flex-1 text-sm truncate hover:text-primary transition-colors"
      >
        {{ node.name }}
      </NuxtLink>

      <!-- Item count badge -->
      <span
        v-if="count > 0"
        class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md tabular-nums shrink-0"
      >
        {{ count }}
      </span>
    </div>

    <!-- Children (recursive) -->
    <div v-if="hasChildren && isExpanded">
      <LocationTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :item-counts="itemCounts"
        :force-expand="forceExpand"
      />
    </div>
  </div>
</template>
