<script setup lang="ts">
import type { TagOut } from "~~/lib/api/types/data-contracts";

defineProps<{
  label: TagOut;
  itemCount?: number;
}>();
</script>

<template>
  <NuxtLink
    :to="`/labels/${label.id}`"
    class="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-sm transition-all"
  >
    <div
      class="w-4 h-4 rounded-full shrink-0"
      :style="{ backgroundColor: label.color || '#6b7280' }"
    />
    <div class="flex-1 min-w-0">
      <h3 class="text-sm font-medium truncate">{{ label.name }}</h3>
      <p v-if="label.description" class="text-xs text-muted-foreground truncate mt-0.5">
        {{ label.description }}
      </p>
    </div>
    <span
      v-if="itemCount !== undefined && itemCount > 0"
      class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md tabular-nums shrink-0"
    >
      {{ itemCount }}
    </span>
  </NuxtLink>
</template>
