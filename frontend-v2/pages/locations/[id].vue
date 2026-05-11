<script setup lang="ts">
import { ChevronRight, MapPin, Pencil, Trash2, Plus, LayoutGrid, List, Layers, ScanLine } from "lucide-vue-next";
import { useLocalStorage } from "@vueuse/core";
import type { LocationOut, ItemSummary } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

definePageMeta({ layout: "default" });

const route = useRoute();
const router = useRouter();
const api = useUserApi();
const tree = useLocationTree();

const locationId = computed(() => route.params.id as string);

// Recursive toggle — persisted globally, single key.
const recursive = useLocalStorage<boolean>("items-recursive", true);

// Location data
const location = ref<LocationOut | null>(null);
const loadingLocation = ref(false);

async function fetchLocation() {
  loadingLocation.value = true;
  try {
    const resp = await api.locations.get(locationId.value);
    if (resp.data) location.value = resp.data;
  } finally {
    loadingLocation.value = false;
  }
}

// Items in this location (and optionally its descendants)
const items = ref<ItemSummary[]>([]);
const totalItems = ref(0);
const page = ref(1);
const pageSize = 25;
const loadingItems = ref(false);

async function fetchItems() {
  // Capture the route param so a rapid nav (A→B) can't let A's late response
  // overwrite B's data after the await.
  const fetchedFor = locationId.value;
  loadingItems.value = true;
  try {
    let locations: string[] = [fetchedFor];
    if (recursive.value) {
      // Synchronous read — empty when tree isn't loaded yet. We don't await
      // tree.ready() here: blocking adds the full /locations/tree latency to
      // first paint, then sequences the /items request after it.
      const subtree = tree.getDescendantIds(fetchedFor);
      if (subtree.length > 1) {
        locations = subtree;
      }
    }
    const resp = await api.items.getAll({
      locations,
      page: page.value,
      pageSize,
    });
    if (locationId.value !== fetchedFor) return;
    if (resp.data) {
      items.value = resp.data.items;
      totalItems.value = resp.data.total;
    }
  } finally {
    if (locationId.value === fetchedFor) {
      loadingItems.value = false;
    }
  }
}

// Fires the items request immediately, then refetches with descendants once
// the tree resolves. No-op refetch when the synchronous fetch already had
// them (tree was cached or location is a leaf).
function fetchItemsWithTreeRefine() {
  // Capture both the route param and the initial descendant count in this
  // closure: avoids a module-level mutable counter that interleaving calls
  // (rapid navigation, recursive toggle) would race over.
  const fetchedFor = locationId.value;
  const initialCount = recursive.value
    ? Math.max(tree.getDescendantIds(fetchedFor).length, 1)
    : 1;
  fetchItems();
  if (!recursive.value) return;
  tree.ready()
    .then(() => {
      if (locationId.value !== fetchedFor) return;
      const expanded = tree.getDescendantIds(fetchedFor);
      if (expanded.length > initialCount) {
        fetchItems();
      }
    })
    .catch(() => {
      // tree.ready() catches its own fetch errors (see use-location-tree.ts).
      // This is defensive in case the then-callback ever throws synchronously.
    });
}

const totalPages = computed(() => Math.ceil(totalItems.value / pageSize));

function setPage(p: number) {
  page.value = p;
  fetchItems();
}

watch(recursive, () => {
  page.value = 1;
  fetchItems();
});

const canBeRecursive = computed(() => tree.hasChildren(locationId.value));

// View mode
const preferences = useViewPreferences();
const viewMode = computed({
  get: () => preferences.value.itemDisplayView,
  set: (v) => { preferences.value.itemDisplayView = v; },
});

// Quantity update
async function handleQuantityUpdate(id: string, quantity: number) {
  await api.items.patch(id, { id, quantity });
  fetchItems();
}

const {
  selectionMode,
  selectedIds,
  selectedItems,
  toggleSelection,
  toggleSelectAll,
  clearSelection,
  exitSelectionMode,
  showBatchLocation,
  showBatchTagAdd,
  showBatchTagRemove,
  showBatchDelete,
  showBatchDuplicate,
  showBatchArchive,
  batchArchiveLabel,
} = useItemSelection(items);

watch([locationId, recursive, page], clearSelection);

// Edit mode
const editing = ref(false);
const editName = ref("");
const editDescription = ref("");

function startEdit() {
  if (!location.value) return;
  editName.value = location.value.name;
  editDescription.value = location.value.description;
  editing.value = true;
}

async function saveEdit() {
  if (!location.value || !editName.value) return;
  const resp = await api.locations.update(location.value.id, {
    id: location.value.id,
    name: editName.value,
    description: editDescription.value,
  });
  if (resp.data) {
    location.value = resp.data;
    editing.value = false;
    tree.invalidate();
    toast.success("Локация обновлена");
  }
}

function cancelEdit() {
  editing.value = false;
}

// Move scanner — preloads queue with everything in this location (and descendants
// when recursive is on). Mirrors the descendant-expansion logic of fetchItems.
const showMoveScanner = ref(false);
const moveScannerPreload = ref<ItemSummary[]>([]);

async function openMoveScannerFromLocation() {
  let locations: string[] = [locationId.value];
  if (recursive.value) {
    await tree.ready();
    const subtree = tree.getDescendantIds(locationId.value);
    if (subtree.length > 1) locations = subtree;
  }
  const resp = await api.items.getAll({
    locations,
    page: 1,
    pageSize: 1000,
  });
  if (resp.data) {
    moveScannerPreload.value = resp.data.items;
    showMoveScanner.value = true;
  } else {
    toast.error("Не удалось получить список");
  }
}

// Delete
const showDeleteDialog = ref(false);

async function confirmDelete() {
  if (!location.value) return;
  const resp = await api.locations.delete(location.value.id);
  if (!resp.error) {
    tree.invalidate();
    toast.success("Локация удалена");
    router.push("/locations");
  } else {
    toast.error("Не удалось удалить локацию");
  }
  showDeleteDialog.value = false;
}

// Create child location
const showCreateChild = ref(false);

function handleChildCreated(id: string) {
  showCreateChild.value = false;
  tree.invalidate();
  router.push(`/locations/${id}`);
}

// Init
onMounted(() => {
  fetchLocation();
  fetchItemsWithTreeRefine();
});

// Re-fetch on route param change (navigating between locations)
watch(locationId, () => {
  fetchLocation();
  page.value = 1;
  fetchItemsWithTreeRefine();
});
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <!-- Loading -->
    <div v-if="loadingLocation && !location" class="space-y-3">
      <Skeleton class="h-6 w-48" />
      <Skeleton class="h-20 w-full rounded-xl" />
    </div>

    <template v-else-if="location">
      <!-- Breadcrumbs -->
      <nav class="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
        <NuxtLink to="/locations" class="hover:text-foreground transition-colors shrink-0">
          Локации
        </NuxtLink>
        <template v-if="location.parent?.id">
          <ChevronRight class="w-3.5 h-3.5 shrink-0" />
          <NuxtLink
            :to="`/locations/${location.parent.id}`"
            class="hover:text-foreground transition-colors truncate"
          >
            {{ location.parent.name }}
          </NuxtLink>
        </template>
        <ChevronRight class="w-3.5 h-3.5 shrink-0" />
        <span class="text-foreground font-medium truncate">{{ location.name }}</span>
      </nav>

      <!-- Header -->
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <template v-if="editing">
            <input
              v-model="editName"
              type="text"
              class="w-full px-3 py-1.5 text-xl font-semibold bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Textarea
              v-model="editDescription"
              class="mt-2"
              placeholder="Описание"
              rows="2"
            />
            <div class="flex gap-2 mt-2">
              <Button size="sm" @click="saveEdit">Сохранить</Button>
              <Button size="sm" variant="outline" @click="cancelEdit">Отмена</Button>
            </div>
          </template>
          <template v-else>
            <h1 class="text-xl font-semibold">{{ location.name }}</h1>
            <p v-if="location.description" class="text-sm text-muted-foreground mt-1">
              {{ location.description }}
            </p>
            <p class="text-sm text-muted-foreground mt-1">
              Стоимость: {{ location.totalPrice.toFixed(2) }}
            </p>
          </template>
        </div>

        <div v-if="!editing" class="flex items-center gap-1 shrink-0">
          <button
            class="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            @click="startEdit"
          >
            <Pencil class="w-4 h-4" />
          </button>
          <button
            class="p-2 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            @click="showDeleteDialog = true"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Child locations -->
      <section v-if="location.children?.length > 0 || showCreateChild">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-medium">Вложенные локации</h2>
          <button
            class="text-xs text-primary hover:underline"
            @click="showCreateChild = true"
          >
            + Добавить
          </button>
        </div>
        <div class="flex gap-2 overflow-x-auto pb-2">
          <LocationChildCard
            v-for="child in location.children"
            :key="child.id"
            :location="child"
          />
        </div>
      </section>

      <!-- Add child button if no children yet -->
      <button
        v-if="!location.children?.length && !showCreateChild"
        class="text-sm text-primary hover:underline"
        @click="showCreateChild = true"
      >
        + Добавить вложенную локацию
      </button>

      <!-- Items section -->
      <section>
        <div class="flex items-center justify-between mb-3 gap-2">
          <h2 class="text-sm font-medium">
            Предметы
            <span class="text-muted-foreground font-normal">({{ totalItems }})</span>
          </h2>
          <div class="flex items-center gap-1">
            <button
              v-if="totalItems > 0"
              class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              :class="selectionMode
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'"
              @click="selectionMode ? exitSelectionMode() : (selectionMode = true)"
            >
              {{ selectionMode ? `Выбрано: ${selectedIds.size}` : 'Выбрать' }}
            </button>
            <button
              v-if="selectionMode"
              class="px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors"
              @click="toggleSelectAll"
            >
              {{ selectedIds.size === items.length ? 'Снять все' : 'Все' }}
            </button>
            <button
              class="p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
              :disabled="totalItems === 0"
              :class="totalItems === 0 ? 'opacity-40 cursor-not-allowed' : ''"
              title="Переместить отсюда сканером"
              @click="openMoveScannerFromLocation"
            >
              <ScanLine class="w-4 h-4" />
            </button>
            <button
              class="p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs"
              :class="[
                recursive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent',
                !canBeRecursive ? 'opacity-40 cursor-not-allowed' : '',
              ]"
              :disabled="!canBeRecursive"
              :title="canBeRecursive ? 'Включая вложенные локации' : 'Нет вложенных локаций'"
              @click="canBeRecursive && (recursive = !recursive)"
            >
              <Layers class="w-4 h-4" />
              <span class="hidden sm:inline">Включая вложенные</span>
            </button>
            <button
              class="p-1.5 rounded-md transition-colors"
              :class="viewMode === 'card' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'"
              @click="viewMode = 'card'"
            >
              <LayoutGrid class="w-4 h-4" />
            </button>
            <button
              class="p-1.5 rounded-md transition-colors"
              :class="viewMode === 'table' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'"
              @click="viewMode = 'table'"
            >
              <List class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loadingItems && items.length === 0" class="space-y-2">
          <Skeleton v-for="i in 4" :key="i" class="h-16 w-full rounded-lg" />
        </div>

        <!-- Empty -->
        <div
          v-else-if="!loadingItems && items.length === 0"
          class="text-center py-8 text-sm text-muted-foreground space-y-3"
        >
          <p>В этой локации пока нет предметов</p>
          <button
            v-if="!recursive && canBeRecursive"
            class="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors"
            @click="recursive = true"
          >
            <Layers class="w-3.5 h-3.5" />
            Показать из вложенных локаций
          </button>
        </div>

        <!-- Grid view -->
        <div
          v-else-if="viewMode === 'card'"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        >
          <ItemCard
            v-for="item in items"
            :key="item.id"
            :item="item"
            :current-location-id="locationId"
            :selection-mode="selectionMode"
            :selected="selectedIds.has(item.id)"
            @quantity-update="handleQuantityUpdate"
            @toggle-select="toggleSelection"
          />
        </div>

        <!-- List view -->
        <div v-else class="bg-card border border-border rounded-xl overflow-hidden">
          <ItemListRow
            v-for="item in items"
            :key="item.id"
            :item="item"
            :current-location-id="locationId"
            :selection-mode="selectionMode"
            :selected="selectedIds.has(item.id)"
            @quantity-update="handleQuantityUpdate"
            @toggle-select="toggleSelection"
          />
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 pt-3">
          <button
            class="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-30 transition-colors"
            :disabled="page <= 1"
            @click="setPage(page - 1)"
          >
            Назад
          </button>
          <span class="text-sm text-muted-foreground tabular-nums">
            {{ page }} / {{ totalPages }}
          </span>
          <button
            class="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-30 transition-colors"
            :disabled="page >= totalPages"
            @click="setPage(page + 1)"
          >
            Вперёд
          </button>
        </div>
      </section>
    </template>

    <!-- Niimbot Print -->
    <NiimbotPrintSection v-if="location" type="location" :id="locationId" />

    <!-- Delete dialog -->
    <AlertDialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить локацию?</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="location">
              В этой локации {{ totalItems }} предметов
              <template v-if="location.children?.length">
                и {{ location.children.length }} вложенных локаций
              </template>.
              Все привязки будут удалены.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmDelete"
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Create child sheet -->
    <LocationCreateSheet
      v-model:open="showCreateChild"
      :parent-id="locationId"
      @created="handleChildCreated"
    />

    <MoveScannerSheet
      :open="showMoveScanner"
      :preload-items="moveScannerPreload"
      :force-queue-mode="true"
      @update:open="showMoveScanner = $event"
      @done="fetchItems(); fetchLocation()"
    />

    <SelectionBar
      v-if="selectionMode && selectedIds.size > 0"
      :count="selectedIds.size"
      :archive-label="batchArchiveLabel"
      @change-location="showBatchLocation = true"
      @add-tags="showBatchTagAdd = true"
      @remove-tags="showBatchTagRemove = true"
      @duplicate="showBatchDuplicate = true"
      @archive="showBatchArchive = true"
      @delete="showBatchDelete = true"
    />

    <BatchLocationSheet
      :open="showBatchLocation"
      :items="selectedItems"
      @update:open="showBatchLocation = $event"
      @done="fetchItems(); fetchLocation(); exitSelectionMode()"
    />
    <BatchTagSheet
      :open="showBatchTagAdd"
      :items="selectedItems"
      mode="add"
      @update:open="showBatchTagAdd = $event"
      @done="fetchItems(); exitSelectionMode()"
    />
    <BatchTagSheet
      :open="showBatchTagRemove"
      :items="selectedItems"
      mode="remove"
      @update:open="showBatchTagRemove = $event"
      @done="fetchItems(); exitSelectionMode()"
    />
    <BatchDeleteSheet
      :open="showBatchDelete"
      :items="selectedItems"
      @update:open="showBatchDelete = $event"
      @done="fetchItems(); fetchLocation(); exitSelectionMode()"
    />
    <BatchDuplicateSheet
      :open="showBatchDuplicate"
      :items="selectedItems"
      @update:open="showBatchDuplicate = $event"
      @done="fetchItems(); fetchLocation(); exitSelectionMode()"
    />
    <BatchArchiveSheet
      :open="showBatchArchive"
      :items="selectedItems"
      @update:open="showBatchArchive = $event"
      @done="fetchItems(); fetchLocation(); exitSelectionMode()"
    />
  </div>
</template>
