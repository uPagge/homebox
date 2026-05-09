# Global Search & Batch Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cmd+K command palette with live search and batch operations (change location, add/remove tags, duplicate, delete) for items.

**Architecture:** Command palette uses existing Reka-UI command components and dialog provider. Batch operations use selection mode on items page with sticky action bar. All batch mutations are sequential single-item API calls via existing ItemsApi methods.

**Tech Stack:** Vue 3, Nuxt 3, Reka-UI command components, vaul-vue Drawer, existing dialog provider system, lucide-vue-next icons.

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `components/app/QuickMenuDialog.vue` | Command palette with search, create actions, navigation |
| `components/items/SelectionBar.vue` | Sticky bottom bar with batch action buttons |
| `components/items/BatchLocationSheet.vue` | Drawer to select new location for batch move |
| `components/items/BatchTagSheet.vue` | Drawer to add/remove tags for selected items |
| `components/items/BatchDeleteSheet.vue` | Delete confirmation drawer |
| `components/items/BatchDuplicateSheet.vue` | Duplicate confirmation drawer |

### Modified files
| File | Changes |
|------|---------|
| `components/app/SearchBar.vue` | Open QuickMenu via dialog provider instead of emitting click |
| `layouts/default.vue` | Render QuickMenuDialog, wire create actions |
| `pages/items/index.vue` | Selection mode, selectedIds state, SelectionBar, batch sheet triggers |
| `components/items/ItemCard.vue` | Checkbox overlay in selection mode |
| `components/items/ItemListRow.vue` | Checkbox in selection mode |

---

### Task 1: QuickMenuDialog — Command Palette

**Files:**
- Create: `components/app/QuickMenuDialog.vue`
- Modify: `components/app/SearchBar.vue`
- Modify: `layouts/default.vue`

- [ ] **Step 1: Create QuickMenuDialog component**

Create `components/app/QuickMenuDialog.vue`:

```vue
<script setup lang="ts">
import {
  Package, MapPin, Tag, LayoutDashboard,
  Wrench, Settings, Plus,
} from "lucide-vue-next";
import type { ItemSummary, LocationOutCount, TagOut } from "~~/lib/api/types/data-contracts";
import { useDebounceFn } from "@vueuse/core";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  create: [type: "item" | "location" | "label"];
}>();

const api = useUserApi();
const router = useRouter();

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
  emit("update:open", false);
  router.push(path);
}

function createAction(type: "item" | "location" | "label") {
  emit("update:open", false);
  emit("create", type);
}

const hasResults = computed(() =>
  searchItems.value.length > 0 ||
  searchLocations.value.length > 0 ||
  searchTags.value.length > 0
);

// Hotkey: Cmd+K / Ctrl+K
useDialogHotkey(DialogID.QuickMenu, { code: "KeyK", ctrl: true });
</script>

<template>
  <CommandDialog
    :open="open"
    :dialog-id="DialogID.QuickMenu"
    @update:open="emit('update:open', $event)"
  >
    <CommandInput v-model="query" placeholder="Поиск..." />
    <CommandList>
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
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
```

- [ ] **Step 2: Update SearchBar to open QuickMenu**

Replace the full content of `components/app/SearchBar.vue`:

```vue
<script setup lang="ts">
import { Search } from "lucide-vue-next";

const { openDialog } = useDialog();

function open() {
  openDialog(DialogID.QuickMenu);
}
</script>

<template>
  <button
    class="w-full flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
    @click="open"
  >
    <Search class="w-4 h-4" />
    <span>Поиск...</span>
    <kbd class="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded hidden md:inline">&#x2318;K</kbd>
  </button>
</template>
```

- [ ] **Step 3: Add QuickMenuDialog to layout**

In `layouts/default.vue`, add after the existing `<LabelCreateSheet>` closing tag (around line 123):

Add import-less component (auto-imported by Nuxt). Add state and wire events.

In the `<script setup>` section, add the `showQuickMenu` ref after line 5:

```typescript
const showQuickMenu = ref(false);
```

Add a watcher to sync with dialog provider. After the `closeCreate` function (after line 33), add:

```typescript
const { activeDialog } = useDialog();

watch(activeDialog, (id) => {
  showQuickMenu.value = id === DialogID.QuickMenu;
});

function onQuickMenuCreate(type: "item" | "location" | "label") {
  activeCreate.value = type as CreateType;
}
```

In the `<template>`, after `</LabelCreateSheet>` (line 125), add:

```html
    <QuickMenuDialog
      :open="showQuickMenu"
      @update:open="showQuickMenu = $event"
      @create="onQuickMenuCreate"
    />
```

Remove the `@click` handler from `<SearchBar>` in both sidebar slot and mobile header — SearchBar now handles opening QuickMenu internally.

In the sidebar template (line 40-42), the `<SearchBar />` no longer needs a click handler — it already opens the dialog on its own.

- [ ] **Step 4: Verify build**

Run: `cd /Users/struchkov/Documents/IdeaProjects/opensource/homebox-niim/homebox/frontend-v2 && pnpm build`
Expected: Build succeeds.

- [ ] **Step 5: Manual test**

Open dev server, click SearchBar or press Cmd+K. Verify:
- Dialog opens with search input
- Typing shows filtered results across items, locations, tags
- Clicking a result navigates to detail page
- Create actions open the corresponding sheet
- Navigate actions go to the correct page

- [ ] **Step 6: Commit**

```bash
git add components/app/QuickMenuDialog.vue components/app/SearchBar.vue layouts/default.vue
git commit -m "feat: add Cmd+K command palette with live search"
```

---

### Task 2: Selection Mode on Items Page

**Files:**
- Modify: `pages/items/index.vue`
- Modify: `components/items/ItemCard.vue`
- Modify: `components/items/ItemListRow.vue`

- [ ] **Step 1: Add selection state to items page**

In `pages/items/index.vue`, add selection mode state after the `viewMode` computed (after line 13):

```typescript
// Selection mode
const selectionMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());

function toggleSelection(id: string) {
  const s = new Set(selectedIds.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  selectedIds.value = s;
}

function toggleSelectAll() {
  if (selectedIds.value.size === items.value.length) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(items.value.map(i => i.id));
  }
}

function exitSelectionMode() {
  selectionMode.value = false;
  selectedIds.value = new Set();
}

// Clear selection on page/filter change
watch([() => filters.page, () => filters.q, () => filters.locations, () => filters.tags], () => {
  selectedIds.value = new Set();
});

// ESC to exit selection mode
onMounted(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape" && selectionMode.value) {
      exitSelectionMode();
    }
  };
  document.addEventListener("keydown", handler);
  onUnmounted(() => document.removeEventListener("keydown", handler));
});

// Selected items as array (for batch sheets)
const selectedItems = computed(() =>
  items.value.filter(i => selectedIds.value.has(i.id))
);
```

- [ ] **Step 2: Add selection UI to items page template**

In the header section of `pages/items/index.vue`, add a "Выбрать" button next to the view mode toggles. Replace the view toggle `<div>` (lines 48-63) with:

```html
      <div class="flex items-center gap-1">
        <button
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
        <div class="w-px h-5 bg-border mx-1" />
        <button
          class="p-2 rounded-md transition-colors"
          :class="viewMode === 'card' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'"
          @click="viewMode = 'card'"
        >
          <LayoutGrid class="w-4 h-4" />
        </button>
        <button
          class="p-2 rounded-md transition-colors"
          :class="viewMode === 'table' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'"
          @click="viewMode = 'table'"
        >
          <List class="w-4 h-4" />
        </button>
      </div>
```

Update `<ItemCard>` usage (around line 110-115) to pass selection props:

```html
      <ItemCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        :selection-mode="selectionMode"
        :selected="selectedIds.has(item.id)"
        @quantity-update="handleQuantityUpdate"
        @toggle-select="toggleSelection"
      />
```

Update `<ItemListRow>` usage (around line 120-125) to pass selection props:

```html
      <ItemListRow
        v-for="item in items"
        :key="item.id"
        :item="item"
        :selection-mode="selectionMode"
        :selected="selectedIds.has(item.id)"
        @quantity-update="handleQuantityUpdate"
        @toggle-select="toggleSelection"
      />
```

- [ ] **Step 3: Update ItemCard with checkbox overlay**

In `components/items/ItemCard.vue`, update the props and add checkbox:

Replace the `<script setup>` section:

```vue
<script setup lang="ts">
import { MapPin, Check } from "lucide-vue-next";
import type { ItemSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  item: ItemSummary;
  selectionMode?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  quantityUpdate: [id: string, quantity: number];
  toggleSelect: [id: string];
}>();

const { thumbnailUrl: makeThumbnailUrl } = useAttachmentUrl();

const thumbnailUrl = computed(() => {
  return makeThumbnailUrl(props.item.id, props.item.thumbnailId || props.item.imageId);
});

function handleClick(e: Event) {
  if (props.selectionMode) {
    e.preventDefault();
    emit("toggleSelect", props.item.id);
  }
}
</script>
```

Replace the `<template>` section:

```vue
<template>
  <NuxtLink
    :to="selectionMode ? undefined : `/items/${item.id}`"
    class="group block bg-card border rounded-xl overflow-hidden transition-all"
    :class="[
      selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30 hover:shadow-sm',
      selectionMode ? 'cursor-pointer' : '',
    ]"
    @click="handleClick"
  >
    <!-- Thumbnail or Initials -->
    <div class="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden relative">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="item.name"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform"
        loading="lazy"
      />
      <ItemInitials v-else :name="item.name" size="lg" />

      <!-- Checkbox overlay -->
      <div
        v-if="selectionMode"
        class="absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
        :class="selected
          ? 'bg-primary border-primary text-primary-foreground'
          : 'bg-card/80 border-muted-foreground/40'"
      >
        <Check v-if="selected" class="w-3 h-3" />
      </div>
    </div>

    <!-- Info -->
    <div class="p-3 space-y-1.5">
      <h3 class="text-sm font-medium leading-tight line-clamp-2">{{ item.name }}</h3>

      <div v-if="item.location" class="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin class="w-3 h-3 shrink-0" />
        <span class="truncate">{{ item.location.name }}</span>
      </div>

      <!-- Tags -->
      <div v-if="item.tags?.length" class="flex flex-wrap gap-1">
        <span
          v-for="tag in item.tags.slice(0, 3)"
          :key="tag.id"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground"
        >
          {{ tag.name }}
        </span>
        <span
          v-if="item.tags.length > 3"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-muted-foreground"
        >
          +{{ item.tags.length - 3 }}
        </span>
      </div>

      <!-- Quantity -->
      <div v-if="!selectionMode" class="flex items-center justify-between pt-1">
        <QuantityStepper
          :quantity="item.quantity"
          @update="emit('quantityUpdate', item.id, $event)"
        />
        <span v-if="item.purchasePrice" class="text-xs text-muted-foreground tabular-nums">
          {{ item.purchasePrice.toFixed(2) }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
```

- [ ] **Step 4: Update ItemListRow with checkbox**

Replace the full `components/items/ItemListRow.vue`:

```vue
<script setup lang="ts">
import { MapPin, ChevronRight, Check } from "lucide-vue-next";
import type { ItemSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  item: ItemSummary;
  selectionMode?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  quantityUpdate: [id: string, quantity: number];
  toggleSelect: [id: string];
}>();

const { thumbnailUrl: makeThumbnailUrl } = useAttachmentUrl();

const thumbnailUrl = computed(() => {
  return makeThumbnailUrl(props.item.id, props.item.thumbnailId || props.item.imageId);
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
    :to="selectionMode ? undefined : `/items/${item.id}`"
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
        <div v-if="item.location" class="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin class="w-3 h-3 shrink-0" />
          <span class="truncate">{{ item.location.name }}</span>
        </div>
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
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/struchkov/Documents/IdeaProjects/opensource/homebox-niim/homebox/frontend-v2 && pnpm build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add pages/items/index.vue components/items/ItemCard.vue components/items/ItemListRow.vue
git commit -m "feat: add selection mode with checkboxes on items page"
```

---

### Task 3: SelectionBar — Sticky Bottom Action Bar

**Files:**
- Create: `components/items/SelectionBar.vue`
- Modify: `pages/items/index.vue`

- [ ] **Step 1: Create SelectionBar component**

Create `components/items/SelectionBar.vue`:

```vue
<script setup lang="ts">
import { MapPin, TagsIcon, Minus, Copy, Trash2 } from "lucide-vue-next";

defineProps<{
  count: number;
}>();

const emit = defineEmits<{
  changeLocation: [];
  addTags: [];
  removeTags: [];
  duplicate: [];
  delete: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div class="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-2xl shadow-lg">
        <span class="text-sm font-medium whitespace-nowrap tabular-nums">
          Выбрано: {{ count }}
        </span>

        <div class="w-px h-5 bg-border" />

        <button
          class="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Переместить"
          @click="emit('changeLocation')"
        >
          <MapPin class="w-4 h-4" />
        </button>
        <button
          class="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Добавить теги"
          @click="emit('addTags')"
        >
          <TagsIcon class="w-4 h-4" />
        </button>
        <button
          class="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Убрать теги"
          @click="emit('removeTags')"
        >
          <Minus class="w-4 h-4" />
        </button>
        <button
          class="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Дублировать"
          @click="emit('duplicate')"
        >
          <Copy class="w-4 h-4" />
        </button>

        <div class="w-px h-5 bg-border" />

        <button
          class="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
          title="Удалить"
          @click="emit('delete')"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </div>
  </Teleport>
</template>
```

- [ ] **Step 2: Add SelectionBar to items page**

In `pages/items/index.vue`, add batch sheet state after the `selectedItems` computed:

```typescript
// Batch action sheets
const showBatchLocation = ref(false);
const showBatchTagAdd = ref(false);
const showBatchTagRemove = ref(false);
const showBatchDelete = ref(false);
const showBatchDuplicate = ref(false);
```

At the end of the `<template>` (before the closing `</div>`), add:

```html
    <!-- Selection Bar -->
    <SelectionBar
      v-if="selectionMode && selectedIds.size > 0"
      :count="selectedIds.size"
      @change-location="showBatchLocation = true"
      @add-tags="showBatchTagAdd = true"
      @remove-tags="showBatchTagRemove = true"
      @duplicate="showBatchDuplicate = true"
      @delete="showBatchDelete = true"
    />
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/struchkov/Documents/IdeaProjects/opensource/homebox-niim/homebox/frontend-v2 && pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/items/SelectionBar.vue pages/items/index.vue
git commit -m "feat: add sticky selection bar with batch action buttons"
```

---

### Task 4: BatchLocationSheet — Bulk Location Change

**Files:**
- Create: `components/items/BatchLocationSheet.vue`
- Modify: `pages/items/index.vue`

- [ ] **Step 1: Create BatchLocationSheet**

Create `components/items/BatchLocationSheet.vue`:

```vue
<script setup lang="ts">
import { Search, X } from "lucide-vue-next";
import type { ItemSummary, LocationOutCount } from "~~/lib/api/types/data-contracts";
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

const selectedLocationName = computed(() =>
  locations.value.find(l => l.id === locationId.value)?.name ?? ""
);

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
        <!-- Location search -->
        <div class="relative">
          <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            v-model="locationSearch"
            type="text"
            class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            :placeholder="selectedLocationName || 'Поиск локации...'"
          />
        </div>

        <!-- Location list -->
        <div
          v-if="locationSearch || !locationId"
          class="max-h-48 overflow-y-auto border border-border rounded-lg bg-card"
        >
          <button
            v-for="loc in filteredLocations"
            :key="loc.id"
            class="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
            :class="loc.id === locationId ? 'bg-primary/10 text-primary font-medium' : ''"
            @click="locationId = loc.id; locationSearch = ''"
          >
            {{ loc.name }}
            <span class="text-xs text-muted-foreground ml-1">({{ loc.itemCount }})</span>
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
```

- [ ] **Step 2: Wire BatchLocationSheet in items page**

In `pages/items/index.vue`, add after the `</SelectionBar>` closing (still inside the main template `<div>`):

```html
    <!-- Batch sheets -->
    <BatchLocationSheet
      :open="showBatchLocation"
      :items="selectedItems"
      @update:open="showBatchLocation = $event"
      @done="fetchItems(); exitSelectionMode()"
    />
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/struchkov/Documents/IdeaProjects/opensource/homebox-niim/homebox/frontend-v2 && pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/items/BatchLocationSheet.vue pages/items/index.vue
git commit -m "feat: add batch location change sheet"
```

---

### Task 5: BatchTagSheet — Bulk Add/Remove Tags

**Files:**
- Create: `components/items/BatchTagSheet.vue`
- Modify: `pages/items/index.vue`

- [ ] **Step 1: Create BatchTagSheet**

Create `components/items/BatchTagSheet.vue`:

```vue
<script setup lang="ts">
import { Check } from "lucide-vue-next";
import type { ItemSummary, TagOut } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  items: ItemSummary[];
  mode: "add" | "remove";
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  done: [];
}>();

const api = useUserApi();

const allTags = ref<TagOut[]>([]);
const selectedTagIds = ref<Set<string>>(new Set());
const processing = ref(false);
const progress = ref(0);

// Tags that exist on at least one selected item (for remove mode)
const unionTagIds = computed(() => {
  const ids = new Set<string>();
  for (const item of props.items) {
    for (const tag of item.tags) {
      ids.add(tag.id);
    }
  }
  return ids;
});

// Tags common to ALL selected items (for add mode — hide those already on all)
const intersectTagIds = computed(() => {
  if (props.items.length === 0) return new Set<string>();
  const sets = props.items.map(item => new Set(item.tags.map(t => t.id)));
  const first = sets[0]!;
  const result = new Set<string>();
  for (const id of first) {
    if (sets.every(s => s.has(id))) result.add(id);
  }
  return result;
});

const availableTags = computed(() => {
  if (props.mode === "add") {
    // Show tags NOT already on all items
    return allTags.value.filter(t => !intersectTagIds.value.has(t.id));
  } else {
    // Show tags present on at least one item
    return allTags.value.filter(t => unionTagIds.value.has(t.id));
  }
});

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    selectedTagIds.value = new Set();
    progress.value = 0;
    processing.value = false;
    const resp = await api.tags.getAll();
    if (resp.data) allTags.value = resp.data;
  }
});

function toggleTag(id: string) {
  const s = new Set(selectedTagIds.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  selectedTagIds.value = s;
}

async function apply() {
  if (selectedTagIds.value.size === 0 || props.items.length === 0) return;
  processing.value = true;
  progress.value = 0;

  let success = 0;
  for (const item of props.items) {
    const currentTagIds = item.tags.map(t => t.id);
    let newTagIds: string[];

    if (props.mode === "add") {
      const addSet = new Set([...currentTagIds, ...selectedTagIds.value]);
      newTagIds = [...addSet];
    } else {
      newTagIds = currentTagIds.filter(id => !selectedTagIds.value.has(id));
    }

    const resp = await api.items.patch(item.id, { id: item.id, tagIds: newTagIds });
    if (!resp.error) success++;
    progress.value++;
  }

  const action = props.mode === "add" ? "Теги добавлены" : "Теги убраны";
  toast.success(`${action}: ${success} из ${props.items.length}`);
  processing.value = false;
  emit("done");
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>
          {{ mode === "add" ? "Добавить теги" : "Убрать теги" }} ({{ items.length }})
        </DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <!-- Tag list -->
        <div class="max-h-64 overflow-y-auto space-y-1">
          <button
            v-for="tag in availableTags"
            :key="tag.id"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors text-left"
            @click="toggleTag(tag.id)"
          >
            <div
              class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="selectedTagIds.has(tag.id)
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-muted-foreground/40'"
            >
              <Check v-if="selectedTagIds.has(tag.id)" class="w-3 h-3" />
            </div>
            <div class="flex items-center gap-2">
              <div
                v-if="tag.color"
                class="w-2.5 h-2.5 rounded-full shrink-0"
                :style="{ backgroundColor: tag.color }"
              />
              <span>{{ tag.name }}</span>
            </div>
          </button>

          <div
            v-if="availableTags.length === 0"
            class="px-3 py-4 text-sm text-muted-foreground text-center"
          >
            {{ mode === "add" ? "Все теги уже назначены" : "Нет тегов для удаления" }}
          </div>
        </div>

        <!-- Progress -->
        <div v-if="processing" class="text-sm text-muted-foreground text-center">
          Обновлено {{ progress }} из {{ items.length }}...
        </div>

        <!-- Apply button -->
        <Button
          class="w-full"
          :disabled="selectedTagIds.size === 0 || processing"
          @click="apply"
        >
          {{ processing ? `${progress}/${items.length}...` : 'Применить' }}
        </Button>
      </div>
    </DrawerContent>
  </Drawer>
</template>
```

- [ ] **Step 2: Wire BatchTagSheet in items page**

In `pages/items/index.vue`, after the `<BatchLocationSheet>` block, add:

```html
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
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/struchkov/Documents/IdeaProjects/opensource/homebox-niim/homebox/frontend-v2 && pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/items/BatchTagSheet.vue pages/items/index.vue
git commit -m "feat: add batch tag add/remove sheet"
```

---

### Task 6: BatchDeleteSheet & BatchDuplicateSheet

**Files:**
- Create: `components/items/BatchDeleteSheet.vue`
- Create: `components/items/BatchDuplicateSheet.vue`
- Modify: `pages/items/index.vue`

- [ ] **Step 1: Create BatchDeleteSheet**

Create `components/items/BatchDeleteSheet.vue`:

```vue
<script setup lang="ts">
import type { ItemSummary } from "~~/lib/api/types/data-contracts";
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
const processing = ref(false);
const progress = ref(0);

async function confirm() {
  if (props.items.length === 0) return;
  processing.value = true;
  progress.value = 0;

  let success = 0;
  for (const item of props.items) {
    const resp = await api.items.delete(item.id);
    if (!resp.error) success++;
    progress.value++;
  }

  toast.success(`Удалено ${success} из ${props.items.length}`);
  processing.value = false;
  emit("done");
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Удалить ({{ items.length }})</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <p class="text-sm text-muted-foreground">
          Удалить {{ items.length }} вещей? Это действие нельзя отменить.
        </p>

        <!-- Progress -->
        <div v-if="processing" class="text-sm text-muted-foreground text-center">
          Удалено {{ progress }} из {{ items.length }}...
        </div>

        <div class="flex gap-2">
          <Button
            variant="outline"
            class="flex-1"
            :disabled="processing"
            @click="emit('update:open', false)"
          >
            Отмена
          </Button>
          <Button
            variant="destructive"
            class="flex-1"
            :disabled="processing"
            @click="confirm"
          >
            {{ processing ? `${progress}/${items.length}...` : 'Удалить' }}
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
```

- [ ] **Step 2: Create BatchDuplicateSheet**

Create `components/items/BatchDuplicateSheet.vue`:

```vue
<script setup lang="ts">
import type { ItemSummary } from "~~/lib/api/types/data-contracts";
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
const processing = ref(false);
const progress = ref(0);

async function confirm() {
  if (props.items.length === 0) return;
  processing.value = true;
  progress.value = 0;

  let success = 0;
  for (const item of props.items) {
    const resp = await api.items.duplicate(item.id);
    if (!resp.error) success++;
    progress.value++;
  }

  toast.success(`Дублировано ${success} из ${props.items.length}`);
  processing.value = false;
  emit("done");
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Дублировать ({{ items.length }})</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <p class="text-sm text-muted-foreground">
          Дублировать {{ items.length }} вещей?
        </p>

        <!-- Progress -->
        <div v-if="processing" class="text-sm text-muted-foreground text-center">
          Дублировано {{ progress }} из {{ items.length }}...
        </div>

        <div class="flex gap-2">
          <Button
            variant="outline"
            class="flex-1"
            :disabled="processing"
            @click="emit('update:open', false)"
          >
            Отмена
          </Button>
          <Button
            class="flex-1"
            :disabled="processing"
            @click="confirm"
          >
            {{ processing ? `${progress}/${items.length}...` : 'Дублировать' }}
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
```

- [ ] **Step 3: Wire both sheets in items page**

In `pages/items/index.vue`, after the last `<BatchTagSheet>` block, add:

```html
    <BatchDeleteSheet
      :open="showBatchDelete"
      :items="selectedItems"
      @update:open="showBatchDelete = $event"
      @done="fetchItems(); exitSelectionMode()"
    />
    <BatchDuplicateSheet
      :open="showBatchDuplicate"
      :items="selectedItems"
      @update:open="showBatchDuplicate = $event"
      @done="fetchItems(); exitSelectionMode()"
    />
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/struchkov/Documents/IdeaProjects/opensource/homebox-niim/homebox/frontend-v2 && pnpm build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/items/BatchDeleteSheet.vue components/items/BatchDuplicateSheet.vue pages/items/index.vue
git commit -m "feat: add batch delete and duplicate sheets"
```

---

## Summary

| Task | Component | What it does |
|------|-----------|-------------|
| 1 | QuickMenuDialog + SearchBar | Cmd+K palette with live search, create actions, navigation |
| 2 | Selection mode | Checkboxes on ItemCard/ItemListRow, select/deselect all |
| 3 | SelectionBar | Sticky bottom bar with action buttons |
| 4 | BatchLocationSheet | Searchable location picker for bulk move |
| 5 | BatchTagSheet | Add/remove tags with smart filtering |
| 6 | BatchDeleteSheet + BatchDuplicateSheet | Confirmation drawers with progress |
