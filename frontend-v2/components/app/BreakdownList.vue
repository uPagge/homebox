<script setup lang="ts">
import type { TotalsByOrganizer } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  items: TotalsByOrganizer[];
  maxItems?: number;
  clickable?: boolean;
}>();

const emit = defineEmits<{
  click: [id: string];
}>();

const displayItems = computed(() => {
  const sorted = [...props.items].sort((a, b) => b.total - a.total);
  return props.maxItems ? sorted.slice(0, props.maxItems) : sorted;
});

const maxValue = computed(() => {
  if (displayItems.value.length === 0) return 1;
  return displayItems.value[0].total || 1;
});
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="item in displayItems"
      :key="item.id"
      class="flex items-center gap-3 group"
      :class="clickable ? 'cursor-pointer' : ''"
      @click="clickable && emit('click', item.id)"
    >
      <span
        class="text-sm truncate w-28 shrink-0"
        :class="clickable ? 'group-hover:text-primary transition-colors' : ''"
      >
        {{ item.name }}
      </span>
      <div class="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          class="h-full bg-primary/60 rounded-full transition-all"
          :style="{ width: `${(item.total / maxValue) * 100}%` }"
        />
      </div>
      <span class="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">
        {{ item.total.toFixed(2) }}
      </span>
    </div>

    <p
      v-if="items.length === 0"
      class="text-sm text-muted-foreground text-center py-4"
    >
      Нет данных
    </p>
  </div>
</template>
