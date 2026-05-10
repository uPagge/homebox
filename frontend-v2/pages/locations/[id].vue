<script setup lang="ts">
import { ChevronRight, MapPin, Pencil, Trash2, Plus, LayoutGrid, List, Layers } from "lucide-vue-next";
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
  loadingItems.value = true;
  try {
    let locations: string[] = [locationId.value];
    if (recursive.value) {
      // Wait for tree before expanding — first paint after navigation may
      // arrive before /v1/locations/tree resolves.
      await tree.ready();
      const subtree = tree.getDescendantIds(locationId.value);
      if (subtree.length > 0) {
        locations = subtree;
      }
    }
    const resp = await api.items.getAll({
      locations,
      page: page.value,
      pageSize,
    });
    if (resp.data) {
      items.value = resp.data.items;
      totalItems.value = resp.data.total;
    }
  } finally {
    loadingItems.value = false;
  }
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
  fetchItems();
});

// Re-fetch on route param change (navigating between locations)
watch(locationId, () => {
  fetchLocation();
  page.value = 1;
  fetchItems();
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
            @quantity-update="handleQuantityUpdate"
          />
        </div>

        <!-- List view -->
        <div v-else class="bg-card border border-border rounded-xl overflow-hidden">
          <ItemListRow
            v-for="item in items"
            :key="item.id"
            :item="item"
            :current-location-id="locationId"
            @quantity-update="handleQuantityUpdate"
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
  </div>
</template>
