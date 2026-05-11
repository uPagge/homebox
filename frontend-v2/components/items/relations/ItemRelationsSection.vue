<script setup lang="ts">
import { Boxes, MapPin, Tag, Plus } from "lucide-vue-next";
import type { ItemSummary, LocationSummary, TagSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  itemId: string;
  parent: ItemSummary | null;
  location: LocationSummary | null;
  tags: TagSummary[];
}>();

const emit = defineEmits<{
  saveParent: [ItemSummary | null];
  saveLocation: [LocationSummary];
  saveTags: [TagSummary[]];
}>();

const tree = useLocationTree();

const parentDrawerOpen = ref(false);
const locationDrawerOpen = ref(false);
const tagsDrawerOpen = ref(false);

const locationPath = computed(() => {
  if (!props.location) return "(не задана)";
  return tree.getPathString(props.location.id) ?? props.location.name;
});

const parentLocationPath = computed(() => {
  const loc = props.parent?.location;
  if (!loc) return "";
  return tree.getPathString(loc.id) ?? loc.name;
});
</script>

<template>
  <div class="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
    <ItemRelationRow :icon="Boxes" label="Родитель" @click="parentDrawerOpen = true">
      <div v-if="parent" class="truncate">
        <span class="font-medium">{{ parent.name }}</span>
        <span v-if="parentLocationPath" class="text-muted-foreground"> · {{ parentLocationPath }}</span>
      </div>
      <div v-else class="text-muted-foreground">Без родителя</div>
    </ItemRelationRow>

    <ItemRelationRow :icon="MapPin" label="Место" @click="locationDrawerOpen = true">
      <div class="truncate">{{ locationPath }}</div>
    </ItemRelationRow>

    <ItemRelationRow :icon="Tag" label="Теги" @click="tagsDrawerOpen = true">
      <div v-if="tags.length > 0" class="flex flex-wrap gap-1.5">
        <span
          v-for="t in tags"
          :key="t.id"
          class="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs"
        >
          <span
            v-if="t.color"
            class="w-2 h-2 rounded-full"
            :style="{ backgroundColor: t.color }"
          />
          {{ t.name }}
        </span>
      </div>
      <div v-else class="text-muted-foreground inline-flex items-center gap-2">
        Без тегов
        <Plus class="w-3.5 h-3.5" />
      </div>
    </ItemRelationRow>

    <ItemParentPickerDrawer
      :open="parentDrawerOpen"
      :value="parent"
      :exclude-id="itemId"
      @update:open="parentDrawerOpen = $event"
      @save="emit('saveParent', $event)"
    />
    <ItemLocationPickerDrawer
      :open="locationDrawerOpen"
      :value="location"
      @update:open="locationDrawerOpen = $event"
      @save="emit('saveLocation', $event)"
    />
    <ItemTagsPickerDrawer
      :open="tagsDrawerOpen"
      :value="tags"
      @update:open="tagsDrawerOpen = $event"
      @save="emit('saveTags', $event)"
    />
  </div>
</template>
