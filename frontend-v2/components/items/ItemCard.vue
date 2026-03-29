<script setup lang="ts">
import { MapPin } from "lucide-vue-next";
import type { ItemSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  item: ItemSummary;
}>();

const emit = defineEmits<{
  quantityUpdate: [id: string, quantity: number];
}>();

const { thumbnailUrl: makeThumbnailUrl } = useAttachmentUrl();

const thumbnailUrl = computed(() => {
  if (!props.item.imageId) return null;
  return makeThumbnailUrl(props.item.id);
});
</script>

<template>
  <NuxtLink
    :to="`/items/${item.id}`"
    class="group block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all"
  >
    <!-- Thumbnail or Initials -->
    <div class="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="item.name"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform"
        loading="lazy"
      />
      <ItemInitials v-else :name="item.name" size="lg" />
    </div>

    <!-- Info -->
    <div class="p-3 space-y-1.5">
      <h3 class="text-sm font-medium leading-tight line-clamp-2">{{ item.name }}</h3>

      <div v-if="item.location" class="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin class="w-3 h-3 shrink-0" />
        <span class="truncate">{{ item.location.name }}</span>
      </div>

      <!-- Tags -->
      <div v-if="item.tags?.length" class="flex flex-wrap gap-1">
        <span
          v-for="tag in item.tags.slice(0, 3)"
          :key="tag.id"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground"
        >
          {{ tag.name }}
        </span>
        <span
          v-if="item.tags.length > 3"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-muted-foreground"
        >
          +{{ item.tags.length - 3 }}
        </span>
      </div>

      <!-- Quantity -->
      <div class="flex items-center justify-between pt-1">
        <QuantityStepper
          :quantity="item.quantity"
          @update="emit('quantityUpdate', item.id, $event)"
        />
        <span v-if="item.purchasePrice" class="text-xs text-muted-foreground tabular-nums">
          {{ item.purchasePrice.toFixed(2) }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
