# Parent Item field in Quick Add — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in «Родительская вещь» picker inside the «Больше подробностей» section of the quick-add sheet, with debounced server-side search, mirroring the location picker's UX.

**Architecture:** Single-file edit to `components/items/QuickAddSheet.vue`. Add reactive state for parent search/selection, a `useDebounceFn`-driven watcher that calls `api.items.getAll({ q, pageSize: 10 })`, a UI section in the template, and pass `parentId` through to `api.items.create`. Reset on close and on "save and another".

**Tech Stack:** Vue 3, Nuxt 3, `@vueuse/core` (`useDebounceFn`), existing `api.items` wrapper from `useUserApi()`, `lucide-vue-next` icons (`Search`, `X`).

**Spec:** `docs/superpowers/specs/2026-05-10-parent-item-quick-add-design.md`

**Files:**
- Modify: `components/items/QuickAddSheet.vue`

No new files, no new tests (project has no component tests for sheets; logic is small enough that manual end-to-end verification on the dev server is the appropriate gate, matching how every other sheet in this codebase ships).

---

## Task 1: Add parent-picker state and debounced search

**Files:**
- Modify: `components/items/QuickAddSheet.vue`

- [ ] **Step 1: Read current state of `QuickAddSheet.vue`** to confirm import block and surrounding context

Run: `wc -l components/items/QuickAddSheet.vue` — expect ~360 lines.

- [ ] **Step 2: Add `useDebounceFn` and `ItemSummary` imports**

In the script-setup imports area near the top, change:

```ts
import { Search, Camera, X } from "lucide-vue-next";
import type { LocationOutCount } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";
```

to:

```ts
import { Search, Camera, X } from "lucide-vue-next";
import { useDebounceFn } from "@vueuse/core";
import type { ItemSummary, LocationOutCount } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";
```

- [ ] **Step 3: Add parent-picker reactive state**

Insert this block immediately AFTER the `selectedLocationName` computed (around line 66, before the first `watch(() => props.open, ...)`):

```ts
// Parent item picker (optional, inside "Больше подробностей")
const parentId = ref("");
const parentSearch = ref("");
const parentResults = ref<ItemSummary[]>([]);
const selectedParent = ref<ItemSummary | null>(null);
const parentLoading = ref(false);
let parentReqSeq = 0;

const debouncedParentSearch = useDebounceFn(async (q: string) => {
  if (!q.trim()) {
    parentResults.value = [];
    parentLoading.value = false;
    return;
  }
  const seq = ++parentReqSeq;
  const resp = await api.items.getAll({ q, pageSize: 10 });
  // Drop stale responses
  if (seq !== parentReqSeq) return;
  parentResults.value = resp.data?.items ?? [];
  parentLoading.value = false;
}, 200);

watch(parentSearch, (val) => {
  if (parentId.value) return; // selection active, dropdown hidden anyway
  if (!val.trim()) {
    parentResults.value = [];
    parentLoading.value = false;
    parentReqSeq++; // invalidate any in-flight request
    return;
  }
  parentLoading.value = true;
  debouncedParentSearch(val);
});

function selectParent(item: ItemSummary) {
  selectedParent.value = item;
  parentId.value = item.id;
  parentSearch.value = "";
  parentResults.value = [];
}

function clearParent() {
  selectedParent.value = null;
  parentId.value = "";
}
```

Notes:
- 200ms debounce to match the existing pattern used in `pages/items/index.vue:69` and `components/app/QuickMenuDialog.vue:53`.
- `parentReqSeq` is a plain `let` (not a ref) — it's mutated only in this module's setup scope and never displayed.
- `selectedParent` stores the full `ItemSummary` so the chip can display the name without an extra fetch.

- [ ] **Step 4: Run typecheck**

Run: `pnpm exec nuxt typecheck`
Expected: pass (no new TS errors). If `nuxt typecheck` is unavailable, run `pnpm exec vue-tsc --noEmit` or skip and rely on dev-server HMR errors.

- [ ] **Step 5: Commit**

```bash
git add components/items/QuickAddSheet.vue
git commit -m "feat(frontend-v2): parent-item picker state in QuickAddSheet (no UI yet)"
```

---

## Task 2: Render the parent-picker UI inside «Больше подробностей»

**Files:**
- Modify: `components/items/QuickAddSheet.vue`

- [ ] **Step 1: Add the UI section to the template**

Locate the `v-if="showMore"` block (around line 322):

```html
<!-- Extended fields -->
<div v-if="showMore" class="space-y-4">
  <div>
    <label class="text-sm font-medium" for="qa-description">Описание</label>
    <Textarea
      id="qa-description"
      v-model="description"
      class="mt-1"
      placeholder="Описание вещи"
      rows="3"
    />
  </div>
</div>
```

Replace it with:

```html
<!-- Extended fields -->
<div v-if="showMore" class="space-y-4">
  <div>
    <label class="text-sm font-medium" for="qa-description">Описание</label>
    <Textarea
      id="qa-description"
      v-model="description"
      class="mt-1"
      placeholder="Описание вещи"
      rows="3"
    />
  </div>

  <!-- Parent item (optional) -->
  <div>
    <label class="text-sm font-medium">Родительская вещь</label>
    <div v-if="!selectedParent" class="mt-1 relative">
      <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        v-model="parentSearch"
        type="text"
        class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Поиск вещи..."
      />
    </div>
    <div
      v-if="!selectedParent && parentSearch"
      class="mt-1 max-h-36 overflow-y-auto border border-border rounded-lg bg-card"
    >
      <div
        v-if="parentLoading"
        class="px-3 py-2 text-sm text-muted-foreground"
      >
        Поиск...
      </div>
      <button
        v-for="item in parentResults"
        :key="item.id"
        class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
        @click="selectParent(item)"
      >
        <div class="text-sm">{{ item.name }}</div>
        <div v-if="item.location?.name" class="text-xs text-muted-foreground">
          {{ item.location.name }}
        </div>
      </button>
      <div
        v-if="!parentLoading && parentResults.length === 0"
        class="px-3 py-2 text-sm text-muted-foreground"
      >
        Ничего не найдено
      </div>
    </div>
    <div
      v-else-if="selectedParent"
      class="mt-1 flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-sm"
    >
      <span class="flex-1 truncate">
        {{ selectedParent.name }}
        <span v-if="selectedParent.location?.name" class="text-muted-foreground">
          · {{ selectedParent.location.name }}
        </span>
      </span>
      <button
        class="text-muted-foreground hover:text-foreground"
        @click="clearParent"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Start the dev server and visually verify**

Run: `pnpm dev` (in another terminal if not already running)

Manual checks:
1. Open the app, click the FAB to open «Добавить вещь».
2. Click «Больше подробностей» → the «Родительская вещь» section appears under the description.
3. Type a query into the parent-search input → after ~200ms, results appear.
4. Click a result → the input is replaced by a chip showing the item name and (if any) its location.
5. Click the X on the chip → input reappears, ready to search again.
6. Empty input shows nothing (no dropdown, no results).
7. Search for nonsense → «Ничего не найдено».

- [ ] **Step 3: Commit**

```bash
git add components/items/QuickAddSheet.vue
git commit -m "feat(frontend-v2): parent-item picker UI in QuickAddSheet"
```

---

## Task 3: Wire parentId into create payload and reset state on close/next

**Files:**
- Modify: `components/items/QuickAddSheet.vue`

- [ ] **Step 1: Pass `parentId` in the multiple-items branch**

In `save()` (around line 106), change:

```ts
const resp = await api.items.create({
  name: name.value,
  locationId: locationId.value,
  quantity: 1,
  description: description.value,
  tagIds: [],
});
```

to:

```ts
const resp = await api.items.create({
  name: name.value,
  locationId: locationId.value,
  quantity: 1,
  description: description.value,
  tagIds: [],
  parentId: parentId.value || undefined,
});
```

- [ ] **Step 2: Pass `parentId` in the single-item branch**

In the same `save()` (around line 129), change:

```ts
const resp = await api.items.create({
  name: name.value,
  locationId: locationId.value,
  quantity: quantity.value,
  description: description.value,
  tagIds: [],
});
```

to:

```ts
const resp = await api.items.create({
  name: name.value,
  locationId: locationId.value,
  quantity: quantity.value,
  description: description.value,
  tagIds: [],
  parentId: parentId.value || undefined,
});
```

- [ ] **Step 3: Reset parent state on "Сохранить и ещё"**

In `save()`, locate the `if (addNext) { ... }` block (around line 155):

```ts
if (addNext) {
  name.value = "";
  quantity.value = 1;
  description.value = "";
  showMore.value = false;
  removePhoto();
} else {
  resetAndClose();
}
```

Change to:

```ts
if (addNext) {
  name.value = "";
  quantity.value = 1;
  description.value = "";
  showMore.value = false;
  removePhoto();
  clearParent();
  parentSearch.value = "";
  parentResults.value = [];
} else {
  resetAndClose();
}
```

- [ ] **Step 4: Reset parent state in `resetAndClose`**

Locate `resetAndClose()` (around line 169):

```ts
function resetAndClose() {
  name.value = "";
  locationId.value = lastLocationId.value;
  quantity.value = 1;
  quantityMode.value = "single";
  description.value = "";
  showMore.value = false;
  locationSearch.value = "";
  removePhoto();
  emit("update:open", false);
}
```

Change to:

```ts
function resetAndClose() {
  name.value = "";
  locationId.value = lastLocationId.value;
  quantity.value = 1;
  quantityMode.value = "single";
  description.value = "";
  showMore.value = false;
  locationSearch.value = "";
  removePhoto();
  clearParent();
  parentSearch.value = "";
  parentResults.value = [];
  emit("update:open", false);
}
```

- [ ] **Step 5: Manual end-to-end verification**

On the running dev server:

1. **Single item with parent:** Open the sheet, fill name + location, expand «Больше подробностей», pick a parent item, click «Сохранить». Open the created item's detail page → confirm it shows the chosen parent.
2. **Multiple separate items with parent:** Set quantity to 3, switch mode to «3 отдельных вещей», pick a parent, save. Confirm all 3 created items have the same parent.
3. **No parent (default path):** Create a normal item without expanding «Больше подробностей» → behaves exactly as before, item has no parent.
4. **«Сохранить и ещё» resets parent:** Pick a parent, save & next → on the empty form, confirm the parent picker is back to empty input (no chip).
5. **Close resets parent:** Pick a parent, dismiss the sheet, reopen → confirm parent picker is empty.

If any of these fail, fix and re-verify before committing.

- [ ] **Step 6: Commit**

```bash
git add components/items/QuickAddSheet.vue
git commit -m "feat(frontend-v2): pass parentId from QuickAddSheet and reset on close"
```

---

## Self-review checklist (run before declaring done)

- [ ] Spec section "Placement" → covered by Task 2 (UI inside `v-if="showMore"`).
- [ ] Spec section "UI" → covered by Task 2 (search input, dropdown with primary/secondary lines, chip, three states).
- [ ] Spec section "Behavior — debounced search" → covered by Task 1 (`useDebounceFn`, 200ms).
- [ ] Spec section "Behavior — race protection" → covered by Task 1 (`parentReqSeq`).
- [ ] Spec section "Behavior — optional payload" → covered by Task 3 (`parentId.value || undefined`).
- [ ] Spec section "Behavior — multiple-items mode" → covered by Task 3 step 1 (loop branch passes `parentId` per iteration).
- [ ] Spec section "Behavior — reset" → covered by Task 3 steps 3 & 4.
- [ ] No `console.log` or `console.warn` introduced (would be stripped in prod per `CLAUDE.md`).
- [ ] No emoji added to source files.
- [ ] No backend changes — frontend-only, preserves upstream-rebase friendliness.
