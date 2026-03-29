<script setup lang="ts">
import type { MaintenanceEntryWithDetails } from "~~/lib/api/types/data-contracts";

defineProps<{
  entry: MaintenanceEntryWithDetails;
}>();

function isCompleted(entry: MaintenanceEntryWithDetails): boolean {
  if (!entry.completedDate) return false;
  const d = new Date(entry.completedDate);
  return d.getFullYear() > 1;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (d.getFullYear() <= 1) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function displayDate(entry: MaintenanceEntryWithDetails): string {
  if (isCompleted(entry)) return formatDate(entry.completedDate);
  return formatDate(entry.scheduledDate);
}
</script>

<template>
  <div class="flex items-center gap-3 p-3 border-b border-border last:border-b-0">
    <!-- Status dot -->
    <div
      class="w-2.5 h-2.5 rounded-full shrink-0"
      :class="isCompleted(entry) ? 'bg-green-500' : 'bg-amber-500'"
    />

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium truncate">{{ entry.name }}</p>
      <NuxtLink
        :to="`/items/${entry.itemID}`"
        class="text-xs text-muted-foreground hover:text-primary transition-colors truncate block"
      >
        {{ entry.itemName }}
      </NuxtLink>
    </div>

    <!-- Date -->
    <span class="text-xs text-muted-foreground tabular-nums shrink-0">
      {{ displayDate(entry) }}
    </span>

    <!-- Cost -->
    <span
      v-if="entry.cost && entry.cost !== '0'"
      class="text-xs text-muted-foreground tabular-nums shrink-0"
    >
      {{ parseFloat(entry.cost).toFixed(2) }}
    </span>

    <!-- Status badge -->
    <span
      class="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
      :class="isCompleted(entry)
        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'"
    >
      {{ isCompleted(entry) ? 'Выполнено' : 'Запланировано' }}
    </span>
  </div>
</template>
