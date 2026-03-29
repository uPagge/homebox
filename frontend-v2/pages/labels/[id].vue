<script setup lang="ts">
import { ChevronRight, Pencil, Check, X, Trash2, Tag, LayoutGrid, List } from "lucide-vue-next";
import type { TagOut, ItemSummary } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

definePageMeta({ layout: "default" });

const route = useRoute();
const router = useRouter();
const api = useUserApi();

const labelId = computed(() => route.params.id as string);

// Label data
const label = ref<TagOut | null>(null);
const loadingLabel = ref(false);

async function fetchLabel() {
  loadingLabel.value = true;
  try {
    const resp = await api.tags.get(labelId.value);
    if (resp.data) label.value = resp.data;
  } finally {
    loadingLabel.value = false;
  }
}

// Items with this label
const items = ref<ItemSummary[]>([]);
const totalItems = ref(0);
const page = ref(1);
const pageSize = 25;
const loadingItems = ref(false);

async function fetchItems() {
  loadingItems.value = true;
  try {
    const resp = await api.items.getAll({
      tags: [labelId.value],
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

// Inline edit
const editing = ref(false);
const editName = ref("");
const editDescription = ref("");
const editColor = ref("");

function startEdit() {
  if (!label.value) return;
  editName.value = label.value.name;
  editDescription.value = label.value.description;
  editColor.value = label.value.color || "#6b7280";
  editing.value = true;
}

async function saveEdit() {
  if (!label.value || !editName.value) return;
  const resp = await api.tags.update(label.value.id, {
    name: editName.value,
    description: editDescription.value,
    color: editColor.value,
  });
  if (resp.data) {
    label.value = resp.data;
    editing.value = false;
    toast.success("Метка обновлена");
  }
}

function cancelEdit() {
  editing.value = false;
}

// Delete
const showDeleteDialog = ref(false);

async function confirmDelete() {
  if (!label.value) return;
  const resp = await api.tags.delete(label.value.id);
  if (!resp.error) {
    toast.success("Метка удалена");
    router.push("/labels");
  } else {
    toast.error("Не удалось удалить метку");
  }
  showDeleteDialog.value = false;
}

// Init
onMounted(() => {
  fetchLabel();
  fetchItems();
});
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <!-- Loading -->
    <div v-if="loadingLabel && !label" class="space-y-3">
      <Skeleton class="h-6 w-48" />
      <Skeleton class="h-20 w-full rounded-xl" />
    </div>

    <template v-else-if="label">
      <!-- Breadcrumbs -->
      <nav class="flex items-center gap-1 text-sm text-muted-foreground">
        <NuxtLink to="/labels" class="hover:text-foreground transition-colors shrink-0">
          Метки
        </NuxtLink>
        <ChevronRight class="w-3.5 h-3.5 shrink-0" />
        <span class="text-foreground font-medium truncate">{{ label.name }}</span>
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
            <div class="mt-2">
              <label class="text-sm font-medium">Цвет</label>
              <div class="mt-1">
                <ColorPalette v-model="editColor" />
              </div>
            </div>
            <div class="flex gap-2 mt-3">
              <Button size="sm" @click="saveEdit">
                <Check class="w-4 h-4 mr-1" />
                Сохранить
              </Button>
              <Button size="sm" variant="outline" @click="cancelEdit">
                <X class="w-4 h-4 mr-1" />
                Отмена
              </Button>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center gap-2">
              <div
                class="w-5 h-5 rounded-full shrink-0"
                :style="{ backgroundColor: label.color || '#6b7280' }"
              />
              <h1 class="text-xl font-semibold">{{ label.name }}</h1>
            </div>
            <p v-if="label.description" class="text-sm text-muted-foreground mt-1">
              {{ label.description }}
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

      <!-- Items section -->
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-medium">
            Предметы
            <span class="text-muted-foreground font-normal">({{ totalItems }})</span>
          </h2>
          <div class="flex items-center gap-1">
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
          class="text-center py-8 text-sm text-muted-foreground"
        >
          Нет предметов с этой меткой
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
            @quantity-update="handleQuantityUpdate"
          />
        </div>

        <!-- List view -->
        <div v-else class="bg-card border border-border rounded-xl overflow-hidden">
          <ItemListRow
            v-for="item in items"
            :key="item.id"
            :item="item"
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

    <!-- Delete dialog -->
    <AlertDialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить метку «{{ label?.name }}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Метка будет удалена. Предметы останутся.
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
  </div>
</template>
