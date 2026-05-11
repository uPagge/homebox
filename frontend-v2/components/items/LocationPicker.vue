<script setup lang="ts">
import { Search, X } from "lucide-vue-next";
import type { LocationOutCount } from "~~/lib/api/types/data-contracts";
import type { HomeboxTarget } from "~/lib/scanner/parse-homebox-url";
import { toast } from "vue-sonner";

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const api = useUserApi();
const tree = useLocationTree();

const locations = ref<LocationOutCount[]>([]);
const locationSearch = ref("");

const filteredLocations = computed(() => {
  if (!locationSearch.value) return locations.value;
  const q = locationSearch.value.toLowerCase();
  return locations.value.filter(l => l.name.toLowerCase().includes(q));
});

const selectedLocationName = computed(() => {
  const loc = locations.value.find(l => l.id === props.modelValue);
  if (!loc) return "";
  return tree.getPathString(loc.id) ?? loc.name;
});

function onScannedLocation(target: HomeboxTarget) {
  if (!locations.value.some(l => l.id === target.id)) {
    toast.error("Локация не найдена в списке");
    return;
  }
  emit("update:modelValue", target.id);
  locationSearch.value = "";
}

function selectLocation(id: string) {
  emit("update:modelValue", id);
  locationSearch.value = "";
}

function clearSelection() {
  emit("update:modelValue", "");
}

onMounted(async () => {
  const resp = await api.locations.getAll();
  if (resp.data) {
    locations.value = resp.data;
  } else {
    toast.error("Не удалось загрузить список локаций");
  }
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          v-model="locationSearch"
          type="text"
          class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          :placeholder="selectedLocationName || placeholder || 'Поиск локации...'"
        />
      </div>
      <ScannerPickerButton :accepts="['location']" @picked="onScannedLocation" />
    </div>

    <div
      v-if="locationSearch || !modelValue"
      class="max-h-48 overflow-y-auto border border-border rounded-lg bg-card"
    >
      <button
        v-for="loc in filteredLocations"
        :key="loc.id"
        class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
        :class="loc.id === modelValue ? 'bg-primary/10 text-primary font-medium' : ''"
        @click="selectLocation(loc.id)"
      >
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-sm">{{ loc.name }}</span>
          <span class="text-xs text-muted-foreground shrink-0">({{ loc.itemCount }})</span>
        </div>
        <div
          v-if="tree.getParentPathString(loc.id)"
          class="text-xs text-muted-foreground truncate"
        >
          {{ tree.getParentPathString(loc.id) }}
        </div>
      </button>
      <div
        v-if="filteredLocations.length === 0"
        class="px-3 py-2 text-sm text-muted-foreground"
      >
        Ничего не найдено
      </div>
    </div>

    <div
      v-else-if="modelValue && selectedLocationName"
      class="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-sm"
    >
      <span class="flex-1">{{ selectedLocationName }}</span>
      <button class="text-muted-foreground hover:text-foreground" @click="clearSelection">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
