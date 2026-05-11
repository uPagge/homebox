<script setup lang="ts">
import { X, MapPin, Tag, Archive } from "lucide-vue-next";
import type { LocationOutCount, TagOut } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  selectedLocations: string[];
  selectedTags: string[];
  includeArchived?: boolean;
}>();

const emit = defineEmits<{
  toggleLocation: [id: string];
  toggleTag: [id: string];
  toggleIncludeArchived: [value: boolean];
  clear: [];
}>();

const api = useUserApi();
const tree = useLocationTree();

function parentPathString(id: string): string {
  const path = tree.getPath(id);
  if (!path || path.length <= 1) return "";
  return path.slice(0, -1).map(p => p.name).join(" › ");
}

// Fetch locations and tags for filter dropdowns
const locations = ref<LocationOutCount[]>([]);
const tags = ref<TagOut[]>([]);

async function loadFilterOptions() {
  const [locResp, tagResp] = await Promise.all([
    api.locations.getAll(),
    api.tags.getAll(),
  ]);
  if (locResp.data) locations.value = locResp.data;
  if (tagResp.data) tags.value = tagResp.data;
}

onMounted(loadFilterOptions);

const hasActiveFilters = computed(() =>
  props.selectedLocations.length > 0 || props.selectedTags.length > 0
);

// Lookup names for selected chips
function locationName(id: string) {
  return tree.getPathString(id) ?? locations.value.find(l => l.id === id)?.name ?? "...";
}

function tagName(id: string) {
  return tags.value.find(t => t.id === id)?.name ?? "...";
}

const showLocationPicker = ref(false);
const showTagPicker = ref(false);
</script>

<template>
  <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
    <!-- Location filter chip -->
    <DropdownMenu v-model:open="showLocationPicker">
      <DropdownMenuTrigger as-child>
        <button
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0"
          :class="selectedLocations.length
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-card border-border text-muted-foreground hover:border-primary/30'"
        >
          <MapPin class="w-3.5 h-3.5" />
          <span v-if="!selectedLocations.length">Location</span>
          <span v-else>{{ locationName(selectedLocations[0]!) }}</span>
          <span v-if="selectedLocations.length > 1" class="text-[10px]">+{{ selectedLocations.length - 1 }}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-56 max-h-64 overflow-y-auto">
        <DropdownMenuCheckboxItem
          v-for="loc in locations"
          :key="loc.id"
          :checked="selectedLocations.includes(loc.id)"
          @select="(e: Event) => { e.preventDefault(); emit('toggleLocation', loc.id); }"
        >
          <div class="flex flex-col min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-sm truncate">{{ loc.name }}</span>
              <span class="text-xs text-muted-foreground shrink-0">{{ loc.itemCount }}</span>
            </div>
            <span
              v-if="parentPathString(loc.id)"
              class="text-xs text-muted-foreground truncate"
            >
              {{ parentPathString(loc.id) }}
            </span>
          </div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Tag filter chip -->
    <DropdownMenu v-model:open="showTagPicker">
      <DropdownMenuTrigger as-child>
        <button
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0"
          :class="selectedTags.length
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-card border-border text-muted-foreground hover:border-primary/30'"
        >
          <Tag class="w-3.5 h-3.5" />
          <span v-if="!selectedTags.length">Labels</span>
          <span v-else>{{ tagName(selectedTags[0]!) }}</span>
          <span v-if="selectedTags.length > 1" class="text-[10px]">+{{ selectedTags.length - 1 }}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-56 max-h-64 overflow-y-auto">
        <DropdownMenuCheckboxItem
          v-for="tag in tags"
          :key="tag.id"
          :checked="selectedTags.includes(tag.id)"
          @select="(e: Event) => { e.preventDefault(); emit('toggleTag', tag.id); }"
        >
          <div class="flex items-center gap-2">
            <div
              v-if="tag.color"
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :style="{ backgroundColor: tag.color }"
            />
            <span class="truncate">{{ tag.name }}</span>
          </div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Archived toggle chip -->
    <button
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0"
      :class="includeArchived
        ? 'bg-primary/10 border-primary/30 text-primary'
        : 'bg-card border-border text-muted-foreground hover:border-primary/30'"
      @click="emit('toggleIncludeArchived', !includeArchived)"
    >
      <Archive class="w-3.5 h-3.5" />
      <span>Архивные</span>
    </button>

    <!-- Clear all -->
    <button
      v-if="hasActiveFilters"
      class="inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
      @click="emit('clear')"
    >
      <X class="w-3.5 h-3.5" />
      Clear
    </button>
  </div>
</template>
