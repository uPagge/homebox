<script setup lang="ts">
import { MapPin, Check, Archive } from "lucide-vue-next";
import type { ItemSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  item: ItemSummary;
  selectionMode?: boolean;
  selected?: boolean;
  currentLocationId?: string;
}>();

const emit = defineEmits<{
  quantityUpdate: [id: string, quantity: number];
  toggleSelect: [id: string];
}>();

const { thumbnailUrl: makeThumbnailUrl } = useAttachmentUrl();
const tree = useLocationTree();

const thumbnailUrl = computed(() => {
  return makeThumbnailUrl(props.item.id, props.item.thumbnailId || props.item.imageId);
});

const showPath = computed(() => {
  if (!props.item.location) return false;
  if (props.currentLocationId && props.currentLocationId === props.item.location.id) return false;
  return true;
});

const pathString = computed(() => {
  if (!props.item.location) return "";
  return tree.getPathString(props.item.location.id) ?? props.item.location.name;
});

function handleClick(e: Event) {
  if (props.selectionMode) {
    e.preventDefault();
    emit("toggleSelect", props.item.id);
  }
}
</script>

<template>
  <NuxtLink
    :to="selectionMode ? undefined : `/items/${item.id}`"
    class="group block bg-card border rounded-xl overflow-hidden transition-all"
    :class="[
      selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30 hover:shadow-sm',
      selectionMode ? 'cursor-pointer' : '',
      item.archived ? 'opacity-60' : '',
    ]"
    @click="handleClick"
  >
    <!-- Thumbnail or Initials -->
    <div class="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden relative">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="item.name"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform"
        loading="lazy"
      />
      <ItemInitials v-else :name="item.name" size="lg" />

      <!-- Checkbox overlay -->
      <div
        v-if="selectionMode"
        class="absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
        :class="selected
          ? 'bg-primary border-primary text-primary-foreground'
          : 'bg-card/80 border-muted-foreground/40'"
      >
        <Check v-if="selected" class="w-3 h-3" />
      </div>

      <!-- Archived badge -->
      <div
        v-if="item.archived"
        class="absolute top-2 right-2 w-6 h-6 rounded-full bg-card/90 border border-border flex items-center justify-center"
        title="В архиве"
      >
        <Archive class="w-3 h-3 text-muted-foreground" />
      </div>
    </div>

    <!-- Info -->
    <div class="p-3 space-y-1.5">
      <h3 class="text-sm font-medium leading-tight line-clamp-2">{{ item.name }}</h3>

      <NuxtLink
        v-if="showPath && item.location"
        :to="`/locations/${item.location.id}`"
        :title="pathString"
        class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-w-0"
        @click.stop
      >
        <MapPin class="w-3 h-3 shrink-0" />
        <bdi class="truncate text-start" style="direction: rtl">{{ pathString }}</bdi>
      </NuxtLink>

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
      <div v-if="!selectionMode" class="flex items-center justify-between pt-1">
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
