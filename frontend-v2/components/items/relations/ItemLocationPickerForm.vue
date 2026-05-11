<script setup lang="ts">
import { Search, X } from "lucide-vue-next";
import type { LocationOutCount, LocationSummary } from "~~/lib/api/types/data-contracts";
import type { HomeboxTarget } from "~/lib/scanner/parse-homebox-url";
import { toast } from "vue-sonner";

const props = defineProps<{
  modelValue: LocationSummary | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [LocationSummary];
}>();

const api = useUserApi();
const tree = useLocationTree();

const locations = ref<LocationOutCount[]>([]);
const search = ref("");

async function load() {
  const resp = await api.locations.getAll();
  if (resp.data) locations.value = resp.data;
}

onMounted(load);

const filtered = computed(() => {
  if (!search.value) return locations.value;
  const q = search.value.toLowerCase();
  return locations.value.filter(l => l.name.toLowerCase().includes(q));
});

const selectedName = computed(() => {
  if (!props.modelValue) return "";
  return tree.getPathString(props.modelValue.id) ?? props.modelValue.name;
});

function selectById(id: string) {
  const loc = locations.value.find(l => l.id === id);
  if (!loc) return;
  emit("update:modelValue", {
    id: loc.id,
    name: loc.name,
    description: loc.description ?? "",
    createdAt: loc.createdAt ?? "",
    updatedAt: loc.updatedAt ?? "",
  });
  search.value = "";
}

function clearSelection() {
  search.value = "";
}

function onScanned(target: HomeboxTarget) {
  if (!locations.value.some(l => l.id === target.id)) {
    toast.error("Локация не найдена в списке");
    return;
  }
  selectById(target.id);
}
</script>

<template>
  <div>
    <div class="flex gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          v-model="search"
          type="text"
          class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          :placeholder="selectedName || 'Поиск локации...'"
        />
      </div>
      <ScannerPickerButton :accepts="['location']" @picked="onScanned" />
    </div>

    <div
      v-if="search || !modelValue"
      class="mt-1 max-h-48 overflow-y-auto border border-border rounded-lg bg-card"
    >
      <button
        v-for="loc in filtered"
        :key="loc.id"
        type="button"
        class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
        :class="modelValue && loc.id === modelValue.id ? 'bg-primary/10 text-primary font-medium' : ''"
        @click="selectById(loc.id)"
      >
        <div class="text-sm">{{ loc.name }}</div>
        <div
          v-if="tree.getParentPathString(loc.id)"
          class="text-xs text-muted-foreground truncate"
        >
          {{ tree.getParentPathString(loc.id) }}
        </div>
      </button>
      <div
        v-if="filtered.length === 0"
        class="px-3 py-2 text-sm text-muted-foreground"
      >
        Ничего не найдено
      </div>
    </div>

    <div
      v-else-if="modelValue && selectedName"
      class="mt-1 flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm"
    >
      <span class="flex-1 truncate">{{ selectedName }}</span>
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground"
        title="Сменить локацию"
        @click="clearSelection"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
