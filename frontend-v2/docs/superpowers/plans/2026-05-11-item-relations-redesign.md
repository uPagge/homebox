# Item Detail Relations Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped chip-row on the item detail page with a structured relations section that lets the user edit parent, location, and tags via drawer-based pickers, fix the silent `parentId`/`tagIds` drop in `saveEdit`, and extract reusable pickers shared with `QuickAddSheet`.

**Architecture:** Top of the item detail page becomes a bordered `ItemRelationsSection` containing three `ItemRelationRow`s (parent / location / tags). Each row taps open a Drawer that wraps a Form picker; the Form picker is the same component reused inline in `QuickAddSheet`. A single `buildItemUpdate` utility centralizes the `ItemOut` → `ItemUpdate` mapping so callers cannot silently drop fields like `parentId` or `tagIds`. Each relation commits independently with optimistic update + rollback on failure.

**Tech Stack:** Nuxt 3 (Vue 3 + `<script setup>`), TypeScript strict, pnpm, `@/components/ui/drawer` (vaul-based), `lucide-vue-next`, `vue-sonner` toasts, no test runtime — verification is manual + `pnpm build` for type safety.

**Spec:** `frontend-v2/docs/superpowers/specs/2026-05-11-item-relations-redesign-design.md`

---

## File Map

**New files:**

- `frontend-v2/lib/api/build-item-update.ts` — pure utility mapping `ItemOut` → `ItemUpdate` with overrides.
- `frontend-v2/components/items/relations/ItemRelationRow.vue` — generic full-width button row with icon + label + value slot + chevron.
- `frontend-v2/components/items/relations/ItemRelationsSection.vue` — bordered card containing three rows + dividers.
- `frontend-v2/components/items/relations/ItemParentPickerForm.vue` — controlled form (`v-model: ItemSummary | null`) for parent search + scanner + clear.
- `frontend-v2/components/items/relations/ItemParentPickerDrawer.vue` — drawer wrapper with buffered value + Save/Cancel.
- `frontend-v2/components/items/relations/ItemLocationPickerForm.vue` — controlled form (`v-model: LocationSummary | null`) for location search + scanner.
- `frontend-v2/components/items/relations/ItemLocationPickerDrawer.vue` — drawer wrapper.
- `frontend-v2/components/items/relations/ItemTagsPickerForm.vue` — controlled form (`v-model: TagSummary[]`) for multi-select + inline tag creation.
- `frontend-v2/components/items/relations/ItemTagsPickerDrawer.vue` — drawer wrapper.

**Modified files:**

- `frontend-v2/pages/items/[id].vue` — remove top chip-row block + location field from "Детали" inline form, add `<ItemRelationsSection>` with three handlers, route `saveEdit` through `buildItemUpdate`.
- `frontend-v2/components/items/QuickAddSheet.vue` — replace inline parent/location/tags blocks with `<*PickerForm>` components, route `save` through `buildItemUpdate` overrides.

---

## Conventions

- **No test runtime.** Each task ends with a `pnpm build` check (catches type errors) and a manual verification checklist. Do not add `vitest`/`playwright` — out of scope.
- **Commits:** four logical commits, each independently buildable. Use the exact subject lines shown in the "Commit" step.
- **Imports:** Nuxt auto-imports components from `components/**` and composables from `composables/**`; no manual import needed for components. Types from `~~/lib/api/types/data-contracts` need explicit `import type`.
- **Toasts:** `import { toast } from "vue-sonner"`.

---

## Commit 1: `buildItemUpdate` utility (fixes `parentId` regression)

### Task 1.1: Create `buildItemUpdate` utility

**Files:**
- Create: `frontend-v2/lib/api/build-item-update.ts`

- [ ] **Step 1: Write the file**

```typescript
import type { ItemOut, ItemUpdate } from "~~/lib/api/types/data-contracts";

/**
 * Single source of truth for ItemOut -> ItemUpdate mapping.
 *
 * Backend ItemUpdate expects flat ids (locationId, parentId, tagIds) rather
 * than the nested edge objects on ItemOut. Forgetting to map any of these
 * silently nulls the field on save. Always route updates through this.
 */
export function buildItemUpdate(item: ItemOut, overrides?: Partial<ItemUpdate>): ItemUpdate {
  return {
    name: item.name,
    description: item.description,
    locationId: item.location?.id ?? "",
    parentId: item.parent?.id ?? null,
    tagIds: item.tags.map(t => t.id),
    quantity: item.quantity,
    manufacturer: item.manufacturer,
    modelNumber: item.modelNumber,
    serialNumber: item.serialNumber,
    notes: item.notes,
    purchaseFrom: item.purchaseFrom,
    purchasePrice: item.purchasePrice,
    purchaseTime: item.purchaseTime,
    warrantyExpires: item.warrantyExpires,
    warrantyDetails: item.warrantyDetails,
    lifetimeWarranty: item.lifetimeWarranty,
    insured: item.insured,
    fields: item.fields,
    archived: item.archived,
    assetId: item.assetId,
    soldTime: item.soldTime,
    soldTo: item.soldTo,
    soldPrice: item.soldPrice,
    soldNotes: item.soldNotes,
    syncChildItemsLocations: item.syncChildItemsLocations,
    ...overrides,
  };
}
```

- [ ] **Step 2: Type-check**

Run from `frontend-v2/`:
```bash
pnpm exec nuxt prepare && pnpm exec vue-tsc --noEmit
```

If `vue-tsc` is not configured, fall back to:
```bash
pnpm build
```

Expected: no type errors. If `ItemUpdate` is missing fields used above, inspect `lib/api/types/data-contracts.ts:622–636` and adjust (it should match the keys above as of v0.25.0).

### Task 1.2: Route `saveEdit` in item detail page through `buildItemUpdate`

**Files:**
- Modify: `frontend-v2/pages/items/[id].vue:227-270`

- [ ] **Step 1: Replace the `saveEdit` body**

Current `saveEdit` (lines 227–270) manually builds `updateData` and silently drops `parentId`. Replace its body so `updateData` comes from `buildItemUpdate`:

```typescript
async function saveEdit() {
  if (!item.value || !editForm.value) return;

  try {
    const updateData = buildItemUpdate(item.value, {
      name: editForm.value.name ?? item.value.name,
      description: editForm.value.description ?? item.value.description,
      locationId: editForm.value.location?.id ?? item.value.location?.id ?? "",
      quantity: editForm.value.quantity ?? item.value.quantity,
      tagIds: (editForm.value.tags ?? item.value.tags).map(t => t.id),
      manufacturer: editForm.value.manufacturer ?? item.value.manufacturer,
      modelNumber: editForm.value.modelNumber ?? item.value.modelNumber,
      serialNumber: editForm.value.serialNumber ?? item.value.serialNumber,
      notes: editForm.value.notes ?? item.value.notes,
      purchaseFrom: editForm.value.purchaseFrom ?? item.value.purchaseFrom,
      purchasePrice: editForm.value.purchasePrice ?? item.value.purchasePrice,
      purchaseTime: editForm.value.purchaseTime ?? item.value.purchaseTime,
      warrantyExpires: editForm.value.warrantyExpires ?? item.value.warrantyExpires,
      warrantyDetails: editForm.value.warrantyDetails ?? item.value.warrantyDetails,
      lifetimeWarranty: editForm.value.lifetimeWarranty ?? item.value.lifetimeWarranty,
      insured: editForm.value.insured ?? item.value.insured,
      fields: editForm.value.fields ?? item.value.fields,
    });

    const resp = await api.items.update(item.value.id, updateData);
    if (resp.data) {
      item.value = resp.data;
      toast.success("Сохранено");
    }
  } catch {
    toast.error("Ошибка сохранения");
  } finally {
    editingSection.value = null;
    editForm.value = {};
  }
}
```

Note: `buildItemUpdate` already handles `parentId` from `item.value.parent?.id` — no longer dropped. All other fields preserved through the base call; only edit-form fields override.

- [ ] **Step 2: Add the import**

At the top of `<script setup>` in `pages/items/[id].vue`, add:

```typescript
import { buildItemUpdate } from "~/lib/api/build-item-update";
```

(Goes alongside the existing `import type { ItemOut, ... }`.)

- [ ] **Step 3: Build check**

From `frontend-v2/`:
```bash
pnpm build
```

Expected: success, no type errors.

### Task 1.3: Route `QuickAddSheet.save` through `buildItemUpdate` (no — uses create, not update)

`QuickAddSheet` calls `api.items.create`, not `update`. `buildItemUpdate` produces `ItemUpdate`, not `ItemCreate`. Skip — the utility does not apply to create.

(This task is intentionally a no-op; documented so future readers don't expect to find a `QuickAddSheet` change in Commit 1.)

### Task 1.4: Manual regression check

- [ ] **Step 1: Run dev server**

```bash
cd frontend-v2 && pnpm dev
```

- [ ] **Step 2: Verify `saveEdit` does not drop `parentId`**

1. Open the dev frontend.
2. Find an item that has a parent (or assign one via the legacy frontend or backend).
3. On the item detail page, tap the pencil on "Детали", change e.g. the description, hit save.
4. Reload the page (`fetchItem()` runs).
5. Confirm the parent chip is still shown.

Before the fix, the parent would disappear because the prior `saveEdit` did not include `parentId` in the payload.

- [ ] **Step 3: Verify `tagIds` round-trip**

1. Find an item with at least one tag.
2. Edit description in "Детали", save.
3. Reload — tags must still be present.

### Task 1.5: Commit

- [ ] **Step 1: Stage + commit**

From repo root:
```bash
git add frontend-v2/lib/api/build-item-update.ts frontend-v2/pages/items/\[id\].vue
git commit -m "$(cat <<'EOF'
refactor(frontend-v2): extract buildItemUpdate utility

Centralize ItemOut -> ItemUpdate mapping so callers cannot silently drop
fields. Fixes a latent regression in pages/items/[id].vue saveEdit which
spread item.value into the payload and never set parentId, so any "Детали"
edit unparented the item server-side.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Verify commit**

```bash
git log -1 --stat
```

Expected: 2 files changed (1 new, 1 modified).

---

## Commit 2: Picker components (Forms + Drawers + RelationsSection)

Each Form is the actual UI; the matching Drawer is a thin wrapper that buffers the value and gates commit behind a Save button. Forms are reused as-is inside `QuickAddSheet`.

### Task 2.1: Create `ItemRelationRow`

**Files:**
- Create: `frontend-v2/components/items/relations/ItemRelationRow.vue`

- [ ] **Step 1: Write the file**

```vue
<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import type { Component } from "vue";

defineProps<{
  icon: Component;
  label: string;
}>();

defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 active:bg-accent/60 transition-colors text-left"
    @click="emit('click')"
  >
    <component :is="icon" class="w-4 h-4 text-muted-foreground shrink-0" />
    <div class="text-xs text-muted-foreground w-20 shrink-0">{{ label }}</div>
    <div class="flex-1 min-w-0 text-sm">
      <slot />
    </div>
    <ChevronRight class="w-4 h-4 text-muted-foreground shrink-0" />
  </button>
</template>
```

- [ ] **Step 2: Build check**

```bash
pnpm build
```

Expected: success.

### Task 2.2: Create `ItemParentPickerForm`

**Files:**
- Create: `frontend-v2/components/items/relations/ItemParentPickerForm.vue`

- [ ] **Step 1: Write the file**

```vue
<script setup lang="ts">
import { Search, X } from "lucide-vue-next";
import { useDebounceFn } from "@vueuse/core";
import type { ItemSummary } from "~~/lib/api/types/data-contracts";
import type { HomeboxTarget } from "~/lib/scanner/parse-homebox-url";
import { toast } from "vue-sonner";

const props = defineProps<{
  modelValue: ItemSummary | null;
  excludeId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [ItemSummary | null];
}>();

const api = useUserApi();
const tree = useLocationTree();

const search = ref("");
const results = ref<ItemSummary[]>([]);
const loading = ref(false);
let reqSeq = 0;

const debouncedSearch = useDebounceFn(async (q: string) => {
  if (!q.trim()) {
    results.value = [];
    loading.value = false;
    return;
  }
  const seq = ++reqSeq;
  const resp = await api.items.getAll({ q, pageSize: 10 });
  if (seq !== reqSeq) return;
  const items = resp.data?.items ?? [];
  results.value = props.excludeId ? items.filter(it => it.id !== props.excludeId) : items;
  loading.value = false;
}, 200);

watch(search, (val) => {
  if (props.modelValue) return;
  if (!val.trim()) {
    results.value = [];
    loading.value = false;
    reqSeq++;
    return;
  }
  loading.value = true;
  debouncedSearch(val);
});

function select(item: ItemSummary) {
  emit("update:modelValue", item);
  search.value = "";
  results.value = [];
}

function clear() {
  emit("update:modelValue", null);
  search.value = "";
  results.value = [];
}

async function onScanned(target: HomeboxTarget) {
  if (target.id === props.excludeId) {
    toast.error("Нельзя сделать вещь родителем самой себя");
    return;
  }
  const resp = await api.items.get(target.id);
  if (resp.error || !resp.data) {
    toast.error("Вещь не найдена");
    return;
  }
  select(resp.data as ItemSummary);
}
</script>

<template>
  <div>
    <div v-if="!modelValue" class="flex gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          v-model="search"
          type="text"
          class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Поиск вещи..."
        />
      </div>
      <ScannerPickerButton :accepts="['item']" @picked="onScanned" />
    </div>

    <div
      v-if="!modelValue && search"
      class="mt-1 max-h-48 overflow-y-auto border border-border rounded-lg bg-card"
    >
      <div v-if="loading" class="px-3 py-2 text-sm text-muted-foreground">
        Поиск...
      </div>
      <button
        v-for="it in results"
        :key="it.id"
        type="button"
        class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
        @click="select(it)"
      >
        <div class="text-sm">{{ it.name }}</div>
        <div v-if="it.location" class="text-xs text-muted-foreground truncate">
          {{ tree.getPathString(it.location.id) ?? it.location.name }}
        </div>
      </button>
      <div
        v-if="!loading && results.length === 0"
        class="px-3 py-2 text-sm text-muted-foreground"
      >
        Ничего не найдено
      </div>
    </div>

    <div
      v-else-if="modelValue"
      class="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm"
    >
      <div class="flex-1 min-w-0">
        <div class="truncate">{{ modelValue.name }}</div>
        <div v-if="modelValue.location" class="text-xs text-muted-foreground truncate">
          {{ tree.getPathString(modelValue.location.id) ?? modelValue.location.name }}
        </div>
      </div>
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground shrink-0"
        :title="'Очистить родителя'"
        @click="clear"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Build check**

```bash
pnpm build
```

### Task 2.3: Create `ItemParentPickerDrawer`

**Files:**
- Create: `frontend-v2/components/items/relations/ItemParentPickerDrawer.vue`

- [ ] **Step 1: Write the file**

```vue
<script setup lang="ts">
import type { ItemSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  open: boolean;
  value: ItemSummary | null;
  excludeId?: string;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  save: [ItemSummary | null];
}>();

const buffer = ref<ItemSummary | null>(props.value);

watch(() => props.open, (isOpen) => {
  if (isOpen) buffer.value = props.value;
});

function confirm() {
  emit("save", buffer.value);
  emit("update:open", false);
}

function cancel() {
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Родитель</DrawerTitle>
      </DrawerHeader>
      <div class="px-4 pb-6 space-y-4">
        <ItemParentPickerForm v-model="buffer" :exclude-id="excludeId" />
        <div class="flex gap-2 pt-2">
          <Button variant="outline" class="flex-1" @click="cancel">Отмена</Button>
          <Button class="flex-1" @click="confirm">Сохранить</Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
```

- [ ] **Step 2: Build check**

```bash
pnpm build
```

### Task 2.4: Create `ItemLocationPickerForm`

**Files:**
- Create: `frontend-v2/components/items/relations/ItemLocationPickerForm.vue`

- [ ] **Step 1: Write the file**

```vue
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
        :title="'Сменить локацию'"
        @click="clearSelection"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
```

Note: the `X` button does NOT emit `update:modelValue` to null — it just clears the local `search` field so the user sees the list again. Location is required by the backend; clearing it entirely is intentionally not supported.

- [ ] **Step 2: Build check**

```bash
pnpm build
```

### Task 2.5: Create `ItemLocationPickerDrawer`

**Files:**
- Create: `frontend-v2/components/items/relations/ItemLocationPickerDrawer.vue`

- [ ] **Step 1: Write the file**

```vue
<script setup lang="ts">
import type { LocationSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  open: boolean;
  value: LocationSummary | null;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  save: [LocationSummary];
}>();

const buffer = ref<LocationSummary | null>(props.value);

watch(() => props.open, (isOpen) => {
  if (isOpen) buffer.value = props.value;
});

function confirm() {
  if (!buffer.value) return;
  emit("save", buffer.value);
  emit("update:open", false);
}

function cancel() {
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Место</DrawerTitle>
      </DrawerHeader>
      <div class="px-4 pb-6 space-y-4">
        <ItemLocationPickerForm v-model="buffer" />
        <div class="flex gap-2 pt-2">
          <Button variant="outline" class="flex-1" @click="cancel">Отмена</Button>
          <Button class="flex-1" :disabled="!buffer" @click="confirm">Сохранить</Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
```

- [ ] **Step 2: Build check**

```bash
pnpm build
```

### Task 2.6: Create `ItemTagsPickerForm`

**Files:**
- Create: `frontend-v2/components/items/relations/ItemTagsPickerForm.vue`

- [ ] **Step 1: Write the file**

```vue
<script setup lang="ts">
import { Search, X, Plus } from "lucide-vue-next";
import type { TagOut, TagSummary } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const props = defineProps<{
  modelValue: TagSummary[];
}>();

const emit = defineEmits<{
  "update:modelValue": [TagSummary[]];
}>();

const api = useUserApi();

const allTags = ref<TagOut[]>([]);
const search = ref("");
const inputFocused = ref(false);
const creating = ref(false);

async function load() {
  const resp = await api.tags.getAll();
  if (resp.data) allTags.value = resp.data;
}

onMounted(load);

const suggestions = computed(() => {
  const q = search.value.trim().toLowerCase();
  const selectedIds = new Set(props.modelValue.map(t => t.id));
  const pool = allTags.value.filter(t => !selectedIds.has(t.id));
  if (!q) return pool;
  return pool.filter(t => t.name.toLowerCase().includes(q));
});

const canCreateNew = computed(() => {
  const q = search.value.trim();
  if (!q) return false;
  const lower = q.toLowerCase();
  const inAll = allTags.value.some(t => t.name.toLowerCase() === lower);
  const inSelected = props.modelValue.some(t => t.name.toLowerCase() === lower);
  return !inAll && !inSelected;
});

function tagOutToSummary(t: TagOut): TagSummary {
  return {
    id: t.id,
    name: t.name,
    color: t.color,
    description: t.description,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function add(tag: TagOut | TagSummary) {
  if (props.modelValue.some(t => t.id === tag.id)) return;
  const summary: TagSummary = "createdAt" in tag
    ? { id: tag.id, name: tag.name, color: tag.color, description: tag.description, createdAt: tag.createdAt, updatedAt: tag.updatedAt }
    : tagOutToSummary(tag as TagOut);
  emit("update:modelValue", [...props.modelValue, summary]);
  search.value = "";
}

function remove(id: string) {
  emit("update:modelValue", props.modelValue.filter(t => t.id !== id));
}

function clearAll() {
  emit("update:modelValue", []);
}

async function createInline() {
  const name = search.value.trim();
  if (!name || creating.value) return;
  creating.value = true;
  try {
    const resp = await api.tags.create({ name, color: "", description: "" });
    if (resp.error || !resp.data) {
      toast.error("Не удалось создать тег");
      return;
    }
    allTags.value = [...allTags.value, resp.data];
    add(resp.data);
  } finally {
    creating.value = false;
  }
}

function onInputBlur() {
  setTimeout(() => { inputFocused.value = false; }, 150);
}
</script>

<template>
  <div>
    <div class="relative">
      <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        v-model="search"
        type="text"
        class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Поиск или создание тега..."
        @focus="inputFocused = true"
        @blur="onInputBlur"
      />
    </div>
    <div
      v-if="inputFocused && (suggestions.length > 0 || canCreateNew)"
      class="mt-1 max-h-48 overflow-y-auto border border-border rounded-lg bg-card"
    >
      <button
        v-for="tag in suggestions"
        :key="tag.id"
        type="button"
        class="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
        @mousedown.prevent="add(tag)"
      >
        <div
          v-if="tag.color"
          class="w-2.5 h-2.5 rounded-full shrink-0"
          :style="{ backgroundColor: tag.color }"
        />
        <span>{{ tag.name }}</span>
      </button>
      <button
        v-if="canCreateNew"
        type="button"
        :disabled="creating"
        class="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors flex items-center gap-2 border-t border-border"
        @mousedown.prevent="createInline"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>{{ creating ? 'Создаём…' : `Создать тег «${search.trim()}»` }}</span>
      </button>
    </div>

    <div
      v-if="modelValue.length > 0"
      class="mt-2 flex flex-wrap gap-1.5"
    >
      <span
        v-for="tag in modelValue"
        :key="tag.id"
        class="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/5 border border-primary/20 rounded-full text-xs"
      >
        <span
          v-if="tag.color"
          class="w-2 h-2 rounded-full"
          :style="{ backgroundColor: tag.color }"
        />
        <span>{{ tag.name }}</span>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground"
          @click="remove(tag.id)"
        >
          <X class="w-3 h-3" />
        </button>
      </span>
    </div>

    <button
      v-if="modelValue.length > 0"
      type="button"
      class="mt-2 text-xs text-muted-foreground hover:text-foreground"
      @click="clearAll"
    >
      Очистить все
    </button>
  </div>
</template>
```

- [ ] **Step 2: Build check**

```bash
pnpm build
```

### Task 2.7: Create `ItemTagsPickerDrawer`

**Files:**
- Create: `frontend-v2/components/items/relations/ItemTagsPickerDrawer.vue`

- [ ] **Step 1: Write the file**

```vue
<script setup lang="ts">
import type { TagSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  open: boolean;
  value: TagSummary[];
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  save: [TagSummary[]];
}>();

const buffer = ref<TagSummary[]>([...props.value]);

watch(() => props.open, (isOpen) => {
  if (isOpen) buffer.value = [...props.value];
});

function confirm() {
  emit("save", buffer.value);
  emit("update:open", false);
}

function cancel() {
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Теги</DrawerTitle>
      </DrawerHeader>
      <div class="px-4 pb-6 space-y-4">
        <ItemTagsPickerForm v-model="buffer" />
        <div class="flex gap-2 pt-2">
          <Button variant="outline" class="flex-1" @click="cancel">Отмена</Button>
          <Button class="flex-1" @click="confirm">Сохранить</Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
```

- [ ] **Step 2: Build check**

```bash
pnpm build
```

### Task 2.8: Create `ItemRelationsSection`

**Files:**
- Create: `frontend-v2/components/items/relations/ItemRelationsSection.vue`

- [ ] **Step 1: Write the file**

```vue
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
```

- [ ] **Step 2: Build check**

```bash
pnpm build
```

Expected: success. No usage yet, so no UI changes visible — components just compile.

### Task 2.9: Commit

- [ ] **Step 1: Stage + commit**

```bash
git add frontend-v2/components/items/relations
git commit -m "$(cat <<'EOF'
feat(frontend-v2): item relation pickers (parent/location/tags)

Adds Form + Drawer pairs for parent, location, and tags pickers, plus
ItemRelationsSection and ItemRelationRow. Logic ported from
QuickAddSheet so the same Form components can be reused inline there in
a follow-up commit. Not consumed yet — only files added.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Verify commit**

```bash
git log -1 --stat
```

Expected: 9 new files.

---

## Commit 3: Migrate `QuickAddSheet` to use Form components

### Task 3.1: Replace location block

**Files:**
- Modify: `frontend-v2/components/items/QuickAddSheet.vue`

`QuickAddSheet` currently keeps `locationId: string` as local state. The Form expects `LocationSummary | null`. We bridge: keep a `selectedLocation: LocationSummary | null` ref and derive `locationId` from it.

- [ ] **Step 1: Replace local state for location**

In `<script setup>` of `QuickAddSheet.vue`, delete the existing block:
```typescript
const locations = ref<LocationOutCount[]>([]);
const locationSearch = ref("");
const tree = useLocationTree();

async function loadLocations() { ... }

const filteredLocations = computed(...);
const selectedLocationName = computed(...);
function onScannedLocation(target: HomeboxTarget) { ... }
```
(lines ~51–79 in the current file)

Replace with:
```typescript
const selectedLocation = ref<LocationSummary | null>(null);
const locationId = computed(() => selectedLocation.value?.id ?? "");
```

(Also keep the unrelated bits: `locations` was unused outside; remove all references. `tree` is no longer needed in this file unless used elsewhere — keep only if other code in the file still references `useLocationTree`.)

- [ ] **Step 2: Remove `loadLocations` from `watch(() => props.open, ...)`**

The Form loads its own locations via `onMounted`. Find:
```typescript
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadLocations();
    loadTags();
    locationSearch.value = "";
  }
});
```
Change to:
```typescript
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadTags();
  }
});
```

- [ ] **Step 3: Adjust context-location and last-used-location wiring**

The existing block (around line 207–217) sets `locationId.value = ...`. That no longer compiles because `locationId` is a computed. Convert to setting `selectedLocation`:

```typescript
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return;
  // Load full locations to resolve LocationSummary from an id
  const resp = await api.locations.getAll();
  const all = resp.data ?? [];
  const wantedId = props.contextLocationId || lastLocationId.value;
  if (wantedId && !selectedLocation.value) {
    const loc = all.find(l => l.id === wantedId);
    if (loc) {
      selectedLocation.value = {
        id: loc.id,
        name: loc.name,
        description: loc.description ?? "",
        createdAt: loc.createdAt ?? "",
        updatedAt: loc.updatedAt ?? "",
      };
    }
  }
});
```

- [ ] **Step 4: Replace template block for location**

In `<template>`, find the `<!-- Location with search -->` block (lines ~336–389) and replace with:

```vue
<div>
  <label class="text-sm font-medium">Место</label>
  <div class="mt-1">
    <ItemLocationPickerForm v-model="selectedLocation" />
  </div>
</div>
```

- [ ] **Step 5: Update `save` and `resetAndClose` to read from `locationId.value`**

The existing `save()` already references `locationId.value` — since it's now a computed, the same code works. In `resetAndClose`, change `locationId.value = lastLocationId.value` (no longer assignable) to:
```typescript
// reset location to last-used on close
selectedLocation.value = null;  // will be re-resolved next open
```

Also drop any reference to `locationSearch.value = ""` in `resetAndClose` and `save(addNext)`.

- [ ] **Step 6: Build check**

```bash
pnpm build
```

Expected: no type errors. If any remain, they will be unused imports — remove them (`LocationOutCount` import may become unused).

### Task 3.2: Replace tags block

**Files:**
- Modify: `frontend-v2/components/items/QuickAddSheet.vue`

- [ ] **Step 1: Replace local state**

Delete lines ~136–195 (the entire tags block: `allTags`, `tagSearch`, `selectedTags`, `tagInputFocused`, `tagCreating`, `loadTags`, `tagSuggestions`, `canCreateNewTag`, `selectTag`, `removeTag`, `createTagInline`, `onTagInputBlur`).

Replace with:
```typescript
const selectedTags = ref<TagSummary[]>([]);
```

(`TagSummary` already imported via `data-contracts` — adjust import: `import type { ..., TagSummary } from "~~/lib/api/types/data-contracts"` and remove `TagOut` if no longer used.)

- [ ] **Step 2: Remove `loadTags` call from `watch`**

In the `watch(() => props.open, ...)` block (now simplified in Task 3.1 step 2), remove `loadTags()`:
```typescript
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    // location prefill handled in separate watcher
  }
});
```

If this watcher becomes empty, delete it.

- [ ] **Step 3: Replace template block for tags**

Find the `<!-- Tags -->` block (lines ~475–542) and replace with:

```vue
<div>
  <label class="text-sm font-medium">Теги</label>
  <div class="mt-1">
    <ItemTagsPickerForm v-model="selectedTags" />
  </div>
</div>
```

- [ ] **Step 4: Update `save` payload**

`save()` already uses `selectedTags.value.map(t => t.id)` to pass `tagIds` — that still works. No change needed there.

- [ ] **Step 5: Update reset paths**

In `save(addNext)` reset branch and `resetAndClose()`, replace:
```typescript
selectedTags.value = [];
tagSearch.value = "";
```
with just:
```typescript
selectedTags.value = [];
```

- [ ] **Step 6: Build check**

```bash
pnpm build
```

### Task 3.3: Replace parent block

**Files:**
- Modify: `frontend-v2/components/items/QuickAddSheet.vue`

- [ ] **Step 1: Replace local state**

Delete lines ~81–134 (`parentId`, `parentSearch`, `parentResults`, `selectedParent`, `parentLoading`, `parentReqSeq`, `debouncedParentSearch`, watcher, `selectParent`, `onScannedParent`, `clearParent`).

Replace with:
```typescript
const selectedParent = ref<ItemSummary | null>(null);
```

- [ ] **Step 2: Replace template block**

Find the `<!-- Parent item (optional) -->` block (lines ~544–604) and replace with:

```vue
<!-- Parent item (optional) -->
<div>
  <label class="text-sm font-medium">Родительская вещь</label>
  <div class="mt-1">
    <ItemParentPickerForm v-model="selectedParent" />
  </div>
</div>
```

- [ ] **Step 3: Update `save` to use `selectedParent`**

Find the two `api.items.create({...})` calls. Replace `parentId: parentId.value || undefined` with:
```typescript
parentId: selectedParent.value?.id || undefined,
```

(There are two call-sites: one in the `quantityMode === "multiple"` branch and one in the `else` branch.)

- [ ] **Step 4: Update reset paths**

In `save(addNext)` reset and `resetAndClose`, replace:
```typescript
clearParent();
parentSearch.value = "";
parentResults.value = [];
```
with:
```typescript
selectedParent.value = null;
```

- [ ] **Step 5: Build check**

```bash
pnpm build
```

Expected: success. Some imports become unused (`Search`, `Camera`, `X`, `Plus` may still be needed for the photo section — leave; `useDebounceFn` no longer needed — remove; `HomeboxTarget` no longer needed — remove if no other usage).

### Task 3.4: Manual verification of `QuickAddSheet`

- [ ] **Step 1: Start dev**

```bash
cd frontend-v2 && pnpm dev
```

- [ ] **Step 2: Create flow checklist**

1. Open `/items` and tap the "+" button to open `QuickAddSheet`.
2. Type a name.
3. Pick a location via search — confirm it appears as a selected pill.
4. Tap the scanner button next to the location field. Scan a known location QR — selection updates.
5. Expand "Больше подробностей".
6. Add a description.
7. Type a partial tag name. Existing matches appear; tap one — chip appears.
8. Type a brand new tag name → "Создать тег «...»" button appears → tap → tag appears as selected chip.
9. Remove a tag chip via its X.
10. Use the parent picker: search for an item, select it. Scanner button works (scan an item QR).
11. Hit "Сохранить" → toast "«...» добавлена", drawer closes.
12. Reopen, hit "Сохранить и ещё" → form clears except (per existing code) the user starts fresh. Verify parent and tags were cleared.
13. Reload page and confirm the created item has the right parent, location, tags.

- [ ] **Step 3: Visual check for drawer nesting**

In step 1, confirm there is no nested `<Drawer>` rendered inside `QuickAddSheet`. The pickers should render inline within the sheet body.

### Task 3.5: Commit

- [ ] **Step 1: Stage + commit**

```bash
git add frontend-v2/components/items/QuickAddSheet.vue
git commit -m "$(cat <<'EOF'
refactor(frontend-v2): use relation picker forms in QuickAddSheet

QuickAddSheet now uses ItemParentPickerForm, ItemLocationPickerForm, and
ItemTagsPickerForm directly (inline, no nested Drawer). Removes ~150
lines of duplicated picker logic. Create flow is visually identical.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Verify commit**

```bash
git log -1 --stat
```

Expected: 1 file changed, large net deletion.

---

## Commit 4: Wire `ItemRelationsSection` into the item detail page

### Task 4.1: Add per-relation handlers and import

**Files:**
- Modify: `frontend-v2/pages/items/[id].vue`

- [ ] **Step 1: Add type import**

Add to the existing top-of-file import block:
```typescript
import type { ItemOut, ItemSummary, LocationOutCount, LocationSummary, TagSummary } from "~~/lib/api/types/data-contracts";
```

(`LocationSummary` and `TagSummary` are the additions.)

- [ ] **Step 2: Add three handlers**

After the existing `handleQuantityUpdate` function, add:

```typescript
async function updateParent(newParent: ItemSummary | null) {
  if (!item.value) return;
  const prev = item.value.parent;
  item.value.parent = newParent;
  try {
    const resp = await api.items.update(
      item.value.id,
      buildItemUpdate(item.value, { parentId: newParent?.id ?? null }),
    );
    if (resp.error || !resp.data) throw new Error("update failed");
    item.value = resp.data;
    toast.success("Сохранено");
  } catch (e) {
    if (item.value) item.value.parent = prev ?? null;
    await fetchItem();
    toast.error(`Не удалось сменить родителя: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function updateLocation(loc: LocationSummary) {
  if (!item.value) return;
  const prev = item.value.location;
  item.value.location = loc;
  try {
    const resp = await api.items.update(
      item.value.id,
      buildItemUpdate(item.value, { locationId: loc.id }),
    );
    if (resp.error || !resp.data) throw new Error("update failed");
    item.value = resp.data;
    toast.success("Сохранено");
  } catch (e) {
    if (item.value) item.value.location = prev ?? null;
    await fetchItem();
    toast.error(`Не удалось сменить локацию: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function updateTags(tags: TagSummary[]) {
  if (!item.value) return;
  const prev = item.value.tags;
  item.value.tags = tags;
  try {
    const resp = await api.items.update(
      item.value.id,
      buildItemUpdate(item.value, { tagIds: tags.map(t => t.id) }),
    );
    if (resp.error || !resp.data) throw new Error("update failed");
    item.value = resp.data;
    toast.success("Сохранено");
  } catch (e) {
    if (item.value) item.value.tags = prev;
    await fetchItem();
    toast.error(`Не удалось сменить теги: ${e instanceof Error ? e.message : String(e)}`);
  }
}
```

- [ ] **Step 3: Build check**

```bash
pnpm build
```

### Task 4.2: Remove the old chip-row block

**Files:**
- Modify: `frontend-v2/pages/items/[id].vue:347-378`

- [ ] **Step 1: Delete the block**

In the `<template>`, find:
```vue
<div class="flex flex-wrap gap-2">
  <NuxtLink v-if="item.parent" ...>
    ...
  </NuxtLink>
  <NuxtLink v-if="item.location" ...>
    ...
  </NuxtLink>
  <div v-for="tag in item.tags" ...>
    ...
  </div>
  <div class="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-0.5 ...">
    <span>Кол-во:</span>
    <QuantityStepper :quantity="item.quantity" @update="handleQuantityUpdate" />
  </div>
</div>
```
(lines 347–378)

Delete the whole block.

- [ ] **Step 2: Insert `<ItemRelationsSection>` in its place**

Insert:
```vue
<ItemRelationsSection
  :item-id="item.id"
  :parent="item.parent ?? null"
  :location="item.location ?? null"
  :tags="item.tags"
  @save-parent="updateParent"
  @save-location="updateLocation"
  @save-tags="updateTags"
/>
```

- [ ] **Step 3: Remove unused icon imports**

The deleted block referenced `Boxes`, `MapPin`, `Tag`. Check if they are used elsewhere in the file. If not, remove from the `lucide-vue-next` import at the top.

- [ ] **Step 4: Build check**

```bash
pnpm build
```

### Task 4.3: Remove location field from "Детали" inline form, surface quantity in read-mode

**Files:**
- Modify: `frontend-v2/pages/items/[id].vue:403-416, 446-465`

- [ ] **Step 1: Delete the location field from edit form**

In the `editingSection === 'details'` branch (around lines 389–444), delete:
```vue
<div>
  <label class="text-xs text-muted-foreground">Место</label>
  <div class="flex gap-2">
    <select ...>
      <option v-for="loc in allLocations" ...>...</option>
    </select>
    <ScannerPickerButton :accepts="['location']" @picked="onScannedLocation" />
  </div>
</div>
```

- [ ] **Step 2: Delete now-unused helpers**

In `<script setup>`, delete:
- `allLocations` ref
- `loadLocationsForEdit` function
- `onScannedLocation` function

The `@edit="() => { startEdit('details'); loadLocationsForEdit(); }"` call needs to be changed to just:
```vue
@edit="startEdit('details')"
```

- [ ] **Step 3: Remove the `locationId` and `tagIds` overrides from `saveEdit`**

Open `saveEdit` (updated in Task 1.2). The `locationId` override is no longer relevant because `editForm` never sets location anymore; the base `buildItemUpdate(item.value)` already pulls `locationId` from `item.value.location?.id`. Same for `tagIds`. Simplify:

```typescript
async function saveEdit() {
  if (!item.value || !editForm.value) return;

  try {
    const updateData = buildItemUpdate(item.value, {
      name: editForm.value.name ?? item.value.name,
      description: editForm.value.description ?? item.value.description,
      quantity: editForm.value.quantity ?? item.value.quantity,
      manufacturer: editForm.value.manufacturer ?? item.value.manufacturer,
      modelNumber: editForm.value.modelNumber ?? item.value.modelNumber,
      serialNumber: editForm.value.serialNumber ?? item.value.serialNumber,
      notes: editForm.value.notes ?? item.value.notes,
    });

    const resp = await api.items.update(item.value.id, updateData);
    if (resp.data) {
      item.value = resp.data;
      toast.success("Сохранено");
    }
  } catch {
    toast.error("Ошибка сохранения");
  } finally {
    editingSection.value = null;
    editForm.value = {};
  }
}
```

(`purchaseFrom`, `purchasePrice`, etc. were never edited inside "Детали" — they belong to "Покупка"/"Гарантия" sections, which are not editable today. `buildItemUpdate` carries them through from `item.value` automatically.)

- [ ] **Step 4: Add Quantity to read-mode "Детали"**

In the read template of the "Детали" section (the `<template v-else>` around lines 446–465), the existing `dl` shows manufacturer/modelNumber/serialNumber/assetId. Add a row for quantity (always shown):

```vue
<dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
  <div>
    <dt class="text-muted-foreground text-xs">Количество</dt>
    <dd>
      <QuantityStepper :quantity="item.quantity" @update="handleQuantityUpdate" />
    </dd>
  </div>
  <div v-if="item.manufacturer">
    <dt class="text-muted-foreground text-xs">Производитель</dt>
    <dd>{{ item.manufacturer }}</dd>
  </div>
  <div v-if="item.modelNumber">
    <dt class="text-muted-foreground text-xs">Модель</dt>
    <dd>{{ item.modelNumber }}</dd>
  </div>
  <div v-if="item.serialNumber">
    <dt class="text-muted-foreground text-xs">Серийный номер</dt>
    <dd class="font-mono text-xs">{{ item.serialNumber }}</dd>
  </div>
  <div v-if="item.assetId && item.assetId !== '0'">
    <dt class="text-muted-foreground text-xs">Asset ID</dt>
    <dd class="font-mono text-xs">{{ item.assetId }}</dd>
  </div>
</dl>
```

- [ ] **Step 5: Remove unused `LocationOutCount` import if needed**

If `allLocations` was the only consumer of `LocationOutCount`, drop it from the import:
```typescript
import type { ItemOut, ItemSummary, LocationSummary, TagSummary } from "~~/lib/api/types/data-contracts";
```

- [ ] **Step 6: Build check**

```bash
pnpm build
```

### Task 4.4: Manual verification of item detail page

- [ ] **Step 1: Start dev**

```bash
cd frontend-v2 && pnpm dev
```

- [ ] **Step 2: Layout check**

Open an item detail page:
1. The new bordered card appears directly below the title/description.
2. Three rows visible: Родитель / Место / Теги, with icons and chevrons.
3. The "Детали" section no longer contains a location field in edit mode; quantity stepper appears in read mode.
4. The old chip row above is gone.

- [ ] **Step 3: Parent flow**

1. Tap the Родитель row → drawer opens.
2. Drawer shows current parent if any, or search input.
3. Search for an item, select it, hit "Сохранить".
4. Row updates with new parent name + parent's location.
5. Reload the page — parent persists.
6. Tap row again, click the X to clear, hit "Сохранить".
7. Row shows "Без родителя".
8. Reload — parent is `null` on the server.
9. Tap row, try to type the current item's own name → it does not appear in search results (`excludeId` filter).
10. Scanner: tap scanner button, scan an item QR — picker selects it.

- [ ] **Step 4: Location flow**

1. Tap Место row → drawer.
2. Pick a different location, hit "Сохранить".
3. Row shows new breadcrumb path.
4. Reload — change persisted.
5. Scanner: scan a location QR → selection updates.
6. Drawer never offers "clear" — location remains required.

- [ ] **Step 5: Tags flow**

1. Tap Теги row → drawer.
2. Add an existing tag → chip appears in drawer body.
3. Type a new tag name → "Создать тег «...»" → tap → tag is created and selected.
4. Remove one tag chip via its X.
5. Hit "Сохранить" → row updates with the new tag set.
6. Reload — tags persisted.
7. Tap row again → "Очистить все" → "Сохранить" → row shows "Без тегов".

- [ ] **Step 6: Optimistic rollback**

1. Throttle or disable network in DevTools (Network → Offline).
2. Tap Место → pick a different location → "Сохранить".
3. Toast `Не удалось сменить локацию: ...` appears.
4. Row reverts to the previous location.
5. Re-enable network — subsequent edits work.

- [ ] **Step 7: Regression check on "Детали" save**

1. Confirm item has a parent and at least one tag.
2. Tap pencil on "Детали", change e.g. description, hit save.
3. Reload — parent and tags are still there.

### Task 4.5: Commit

- [ ] **Step 1: Stage + commit**

```bash
git add frontend-v2/pages/items/\[id\].vue
git commit -m "$(cat <<'EOF'
feat(frontend-v2): item detail relations section

Replaces the top chip row on the item detail page with a dedicated
ItemRelationsSection card. Parent, location, and tags each open a
drawer-based picker and commit independently with optimistic update +
rollback. Quantity moves out of the top row and into the "Детали" read
view. Location field removed from the "Детали" inline edit form (now
edited from its own row).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Verify commit**

```bash
git log -1 --stat
git log --oneline -5
```

Expected: 1 file modified. Branch now ahead by 4 commits (spec + the 4 implementation commits).

---

## Final Verification

- [ ] **Step 1: Full build + lint**

```bash
cd frontend-v2 && pnpm build && pnpm lint
```

Expected: both clean.

- [ ] **Step 2: Run through the spec verification checklist**

Open `frontend-v2/docs/superpowers/specs/2026-05-11-item-relations-redesign-design.md` and run every checkbox under the "Verification" section. Confirm all pass.

- [ ] **Step 3: Branch summary**

```bash
git log --oneline main..HEAD
```

Expected output (subjects, hashes will differ):
```
<hash> feat(frontend-v2): item detail relations section
<hash> refactor(frontend-v2): use relation picker forms in QuickAddSheet
<hash> feat(frontend-v2): item relation pickers (parent/location/tags)
<hash> refactor(frontend-v2): extract buildItemUpdate utility
<hash> docs(frontend-v2): item detail relations redesign spec
```
