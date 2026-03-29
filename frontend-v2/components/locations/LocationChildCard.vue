<script setup lang="ts">
import { MapPin } from "lucide-vue-next";
import type { LocationSummary } from "~~/lib/api/types/data-contracts";

defineProps<{
  location: LocationSummary;
}>();
</script>

<template>
  <NuxtLink
    :to="`/locations/${location.id}`"
    class="flex items-center gap-2.5 px-3 py-2.5 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-sm transition-all min-w-[140px] shrink-0"
  >
    <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      <MapPin class="w-4 h-4 text-primary" />
    </div>
    <span class="text-sm font-medium truncate">{{ location.name }}</span>
  </NuxtLink>
</template>
