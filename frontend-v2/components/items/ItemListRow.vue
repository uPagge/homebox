<script setup lang="ts">
import { MapPin, ChevronRight, Check } from "lucide-vue-next";
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
    :to="selectionMode ? undefined : {
      path: `/items/${item.id}`,
      query: currentLocationId ? { from: currentLocationId } : undefined,
    }"
    class="flex items-center gap-3 px-4 py-3 transition-colors border-b border-border last:border-b-0"
    :class="[
      selected ? 'bg-primary/5' : 'hover:bg-accent/50',
      selectionMode ? 'cursor-pointer' : '',
    ]"
    @click="handleClick"
  >
    <!-- Checkbox -->
    <div
      v-if="selectionMode"
      class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
      :class="selected
        ? 'bg-primary border-primary text-primary-foreground'
        : 'border-muted-foreground/40'"
    >
      <Check v-if="selected" class="w-3 h-3" />
    </div>

    <!-- Thumbnail -->
    <div class="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-muted/30 flex items-center justify-center">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="item.name"
        class="w-full h-full object-cover"
        loading="lazy"
      />
      <ItemInitials v-else :name="item.name" size="sm" />
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <h3 class="text-sm font-medium truncate">{{ item.name }}</h3>
      <div class="flex items-center gap-2 mt-0.5">
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
        <span
          v-for="tag in item.tags?.slice(0, 2)"
          :key="tag.id"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground"
        >
          {{ tag.name }}
        </span>
      </div>
    </div>

    <!-- Quantity + Chevron -->
    <div class="flex items-center gap-2 shrink-0">
      <QuantityStepper
        v-if="!selectionMode"
        :quantity="item.quantity"
        @update="emit('quantityUpdate', item.id, $event)"
      />
      <ChevronRight v-if="!selectionMode" class="w-4 h-4 text-muted-foreground" />
    </div>
  </NuxtLink>
</template>
