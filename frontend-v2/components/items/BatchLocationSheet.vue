<script setup lang="ts">
import { Search, X } from "lucide-vue-next";
import type { ItemSummary, LocationOutCount } from "~~/lib/api/types/data-contracts";
import type { HomeboxTarget } from "~/lib/scanner/parse-homebox-url";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  items: ItemSummary[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  done: [];
}>();

const api = useUserApi();
const tree = useLocationTree();

const locations = ref<LocationOutCount[]>([]);
const locationSearch = ref("");
const locationId = ref("");
const processing = ref(false);
const progress = ref(0);

const filteredLocations = computed(() => {
  if (!locationSearch.value) return locations.value;
  const q = locationSearch.value.toLowerCase();
  return locations.value.filter(l => l.name.toLowerCase().includes(q));
});

const selectedLocationName = computed(() => {
  const loc = locations.value.find(l => l.id === locationId.value);
  if (!loc) return "";
  return tree.getPathString(loc.id) ?? loc.name;
});

function onScannedLocation(target: HomeboxTarget) {
  if (!locations.value.some(l => l.id === target.id)) {
    toast.error("Локация не найдена в списке");
    return;
  }
  locationId.value = target.id;
  locationSearch.value = "";
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    locationSearch.value = "";
    locationId.value = "";
    progress.value = 0;
    processing.value = false;
    const resp = await api.locations.getAll();
    if (resp.data) locations.value = resp.data;
  }
});

async function apply() {
  if (!locationId.value || props.items.length === 0) return;
  processing.value = true;
  progress.value = 0;

  let success = 0;
  for (const item of props.items) {
    const resp = await api.items.patch(item.id, { id: item.id, locationId: locationId.value });
    if (!resp.error) success++;
    progress.value++;
  }

  toast.success(`Перемещено ${success} из ${props.items.length}`);
  processing.value = false;
  emit("done");
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Переместить ({{ items.length }})</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <!-- Location search + scan -->
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              v-model="locationSearch"
              type="text"
              class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              :placeholder="selectedLocationName || 'Поиск локации...'"
            />
          </div>
          <ScannerPickerButton :accepts="['location']" @picked="onScannedLocation" />
        </div>

        <!-- Location list -->
        <div
          v-if="locationSearch || !locationId"
          class="max-h-48 overflow-y-auto border border-border rounded-lg bg-card"
        >
          <button
            v-for="loc in filteredLocations"
            :key="loc.id"
            class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
            :class="loc.id === locationId ? 'bg-primary/10 text-primary font-medium' : ''"
            @click="locationId = loc.id; locationSearch = ''"
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

        <!-- Selected location chip -->
        <div
          v-else-if="locationId && selectedLocationName"
          class="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-sm"
        >
          <span class="flex-1">{{ selectedLocationName }}</span>
          <button class="text-muted-foreground hover:text-foreground" @click="locationId = ''">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Progress -->
        <div v-if="processing" class="text-sm text-muted-foreground text-center">
          Обновлено {{ progress }} из {{ items.length }}...
        </div>

        <!-- Apply button -->
        <Button
          class="w-full"
          :disabled="!locationId || processing"
          @click="apply"
        >
          {{ processing ? `${progress}/${items.length}...` : 'Применить' }}
        </Button>
      </div>
    </DrawerContent>
  </Drawer>
</template>
