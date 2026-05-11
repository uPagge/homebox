<script setup lang="ts">
import {
  Package, MapPin, Tag, LayoutDashboard,
  Wrench, Settings, Plus, ScanLine,
} from "lucide-vue-next";
import type { ItemSummary, LocationOutCount, TagOut } from "~~/lib/api/types/data-contracts";
import { useDebounceFn } from "@vueuse/core";
import { useDialogHotkey, DialogID, useDialog } from "@/components/ui/dialog-provider/utils";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  create: [type: "item" | "location" | "label"];
}>();

const api = useUserApi();
const router = useRouter();
const { openDialog, closeDialog } = useDialog();

const query = ref("");
const searchItems = ref<ItemSummary[]>([]);
const searchLocations = ref<LocationOutCount[]>([]);
const searchTags = ref<TagOut[]>([]);
const searching = ref(false);

// All locations and tags loaded once when dialog opens
const allLocations = ref<LocationOutCount[]>([]);
const allTags = ref<TagOut[]>([]);

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    query.value = "";
    searchItems.value = [];
    searchLocations.value = [];
    searchTags.value = [];
    const [locResp, tagResp] = await Promise.all([
      api.locations.getAll(),
      api.tags.getAll(),
    ]);
    if (locResp.data) allLocations.value = locResp.data;
    if (tagResp.data) allTags.value = tagResp.data;
  } else {
    query.value = "";
    searchItems.value = [];
    searchLocations.value = [];
    searchTags.value = [];
  }
});

const doSearch = useDebounceFn(async (q: string) => {
  if (!q.trim()) {
    searchItems.value = [];
    searchLocations.value = [];
    searchTags.value = [];
    return;
  }
  searching.value = true;
  try {
    const lower = q.toLowerCase();
    // Items: server-side search
    const itemResp = await api.items.getAll({ q, pageSize: 5 });
    if (itemResp.data) searchItems.value = itemResp.data.items;
    // Locations: client-side filter
    searchLocations.value = allLocations.value
      .filter(l => l.name.toLowerCase().includes(lower))
      .slice(0, 5);
    // Tags: client-side filter
    searchTags.value = allTags.value
      .filter(t => t.name.toLowerCase().includes(lower))
      .slice(0, 5);
  } finally {
    searching.value = false;
  }
}, 200);

watch(query, (val) => doSearch(val));

function go(path: string) {
  closeDialog(DialogID.QuickMenu);
  router.push(path);
}

function createAction(type: "item" | "location" | "label") {
  closeDialog(DialogID.QuickMenu);
  emit("create", type);
}

function openScanner(): void {
  closeDialog(DialogID.QuickMenu);
  openDialog(DialogID.Scanner);
}

const hasResults = computed(() =>
  searchItems.value.length > 0 ||
  searchLocations.value.length > 0 ||
  searchTags.value.length > 0
);

// Hotkey: Ctrl+K for Windows/Linux
useDialogHotkey(DialogID.QuickMenu, { code: "KeyK", ctrl: true, meta: false });
// Hotkey: Cmd+K for Mac
useDialogHotkey(DialogID.QuickMenu, { code: "KeyK", meta: true, ctrl: false });
</script>

<template>
  <CommandDialog
    :open="open"
    :dialog-id="DialogID.QuickMenu"
    @update:open="emit('update:open', $event)"
  >
    <CommandInput v-model="query" placeholder="Поиск..." />
    <CommandList class="max-h-[70vh]">
      <CommandEmpty v-if="query && !hasResults && !searching">
        Ничего не найдено
      </CommandEmpty>

      <!-- Search results: Items -->
      <CommandGroup v-if="searchItems.length" heading="Вещи">
        <CommandItem
          v-for="item in searchItems"
          :key="item.id"
          :value="`item-${item.id}`"
          @select="go(`/items/${item.id}`)"
        >
          <Package class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>{{ item.name }}</span>
          <span v-if="item.location" class="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">
            {{ item.location.name }}
          </span>
        </CommandItem>
      </CommandGroup>

      <!-- Search results: Locations -->
      <CommandGroup v-if="searchLocations.length" heading="Локации">
        <CommandItem
          v-for="loc in searchLocations"
          :key="loc.id"
          :value="`loc-${loc.id}`"
          @select="go(`/locations/${loc.id}`)"
        >
          <MapPin class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>{{ loc.name }}</span>
          <span class="ml-auto text-xs text-muted-foreground">{{ loc.itemCount }}</span>
        </CommandItem>
      </CommandGroup>

      <!-- Search results: Tags -->
      <CommandGroup v-if="searchTags.length" heading="Теги">
        <CommandItem
          v-for="tag in searchTags"
          :key="tag.id"
          :value="`tag-${tag.id}`"
          @select="go(`/labels/${tag.id}`)"
        >
          <Tag class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>{{ tag.name }}</span>
        </CommandItem>
      </CommandGroup>

      <CommandSeparator v-if="hasResults" />

      <!-- Create -->
      <CommandGroup heading="Создать">
        <CommandItem value="create-item" @select="createAction('item')">
          <Plus class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Вещь</span>
        </CommandItem>
        <CommandItem value="create-location" @select="createAction('location')">
          <Plus class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Локация</span>
        </CommandItem>
        <CommandItem value="create-label" @select="createAction('label')">
          <Plus class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Тег</span>
        </CommandItem>
      </CommandGroup>

      <CommandSeparator />

      <!-- Navigate -->
      <CommandGroup heading="Перейти">
        <CommandItem value="nav-home" @select="go('/')">
          <LayoutDashboard class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Главная</span>
        </CommandItem>
        <CommandItem value="nav-items" @select="go('/items')">
          <Package class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Предметы</span>
        </CommandItem>
        <CommandItem value="nav-locations" @select="go('/locations')">
          <MapPin class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Локации</span>
        </CommandItem>
        <CommandItem value="nav-labels" @select="go('/labels')">
          <Tag class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Теги</span>
        </CommandItem>
        <CommandItem value="nav-maintenance" @select="go('/maintenance')">
          <Wrench class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Обслуживание</span>
        </CommandItem>
        <CommandItem value="nav-settings" @select="go('/settings')">
          <Settings class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Настройки</span>
        </CommandItem>
        <CommandItem value="nav-scan" @select="openScanner">
          <ScanLine class="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Сканировать</span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
