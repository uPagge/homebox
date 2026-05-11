<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import type { Component } from "vue";

defineProps<{
  icon: Component;
  label: string;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 active:bg-accent/60 transition-colors text-left"
    @click="emit('click')"
  >
    <component :is="icon" class="w-4 h-4 text-muted-foreground shrink-0" />
    <div class="text-xs text-muted-foreground w-20 shrink-0">{{ label }}</div>
    <div class="flex-1 min-w-0 text-sm">
      <slot />
    </div>
    <ChevronRight class="w-4 h-4 text-muted-foreground shrink-0" />
  </button>
</template>
