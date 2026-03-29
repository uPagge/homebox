<script setup lang="ts">
import type { Component } from "vue";

defineProps<{
  icon: Component;
  label: string;
  value: string | number;
  to?: string;
}>();
</script>

<template>
  <component
    :is="to ? resolveComponent('NuxtLink') : 'div'"
    :to="to"
    class="bg-card border border-border rounded-xl p-4 flex items-center gap-3 transition-colors"
    :class="to ? 'hover:border-primary/30 hover:shadow-sm cursor-pointer' : ''"
  >
    <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      <component :is="icon" class="w-5 h-5 text-primary" />
    </div>
    <div class="min-w-0">
      <p class="text-xs text-muted-foreground">{{ label }}</p>
      <p class="text-lg font-semibold tabular-nums truncate">{{ value }}</p>
    </div>
  </component>
</template>
