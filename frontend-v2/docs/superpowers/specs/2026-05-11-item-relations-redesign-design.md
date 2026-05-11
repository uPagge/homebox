# Item detail relations redesign — design

Date: 2026-05-11
Scope: frontend-v2

## Problem

On the item detail page (`pages/items/[id].vue`) the user cannot edit two of the item's relations: **parent item** and **tags**. They are shown as small read-only chips in a `flex-wrap` row alongside location and quantity, all squeezed into a single line with `max-w-[60vw]` truncation. Important information (full location breadcrumb path, parent name with context) gets cut off.

Two concrete defects today:

1. **No edit UI for parent or tags.** The inline-editable "Детали" section only lets the user change name, description, location, manufacturer, model, serial, quantity.
2. **Existing `saveEdit` silently drops `parentId`.** The function spreads `item.value` (which has `parent` object, not `parentId`) into the update payload and never sets `parentId` explicitly. Per `ItemUpdate` contract (`lib/api/types/data-contracts.ts:633`), the backend expects `parentId: string | null`. So any "Save" inside "Детали" today **unparents the item**. This is a regression that must be fixed as part of this work.

The chip-row layout itself is also cramped and treats three semantically different things (single relation with hierarchy = location, single relation with rich context = parent, flat multi-value = tags) identically.

## Goals

- All three "relations" (parent, location, tags) are first-class, viewable in full, and editable directly from the item detail page.
- Each relation gets a visual treatment that fits its data shape.
- One source of truth for `ItemUpdate` payload assembly — no more silent `parentId`/`tagIds` drops.
- The same picker components are reused in `QuickAddSheet`, eliminating ~150 lines of duplicated logic and keeping create-flow and edit-flow visually consistent.

## Non-goals

- A "Move children too" checkbox in the location drawer (uses existing `syncChildItemsLocations` flag as-is).
- Creating a new location or new parent item from inside the picker drawer (existing pages handle creation).
- Cycle detection on the frontend for parent reassignment (relies on backend rejection).
- Playwright/component-level e2e for the new pickers. (Unit tests for `buildItemUpdate` are in scope; vitest is configured in this project.)
- Drag-and-drop or reorder for tags.

## Architecture

### Page structure (after)

```
[Photo]
[Title + archived badge]
[Description]

┌─ ItemRelationsSection ─────────────────────────────────────┐
│ [Boxes]  Родитель    «Папа-коробка» · Дом / Кухня       › │ ← tap
│ ──────────────────────────────────────────────────────     │
│ [Pin]    Место        Дом / Кухня / Шкаф / Полка        › │ ← tap
│ ──────────────────────────────────────────────────────     │
│ [Tag]    Теги         [электроника] [мелочь] [+]          │ ← tap row / chip / +
└────────────────────────────────────────────────────────────┘

[ItemDetailSection «Детали»]   ← location removed; quantity stays
[ItemDetailSection «Покупка»]
[ItemDetailSection «Гарантия»]
[ItemDetailSection «Заметки»]
[ItemDetailSection «Файлы»]
[ItemDetailSection «Поля»]
[ItemDetailSection «Содержимое»]
[ItemMaintenanceSection]
[NiimbotPrintSection]
[Action buttons]
```

The standalone top chip-row (`pages/items/[id].vue:347–378`) and the location field inside the "Детали" inline form (`pages/items/[id].vue:403–416`) both go away. Quantity moves out of the chip row and back into "Детали" — it is an attribute, not a relation.

### Components (new)

All under `components/items/relations/`. Two layers per relation: a **Form** (the actual UI, always rendered, no container) and a **Drawer** (wraps the Form in `<Drawer>` with confirm/cancel header). Plus the relations section UI on the detail page.

| Component | Purpose |
|---|---|
| `ItemRelationsSection.vue` | Bordered card on the detail page holding three `ItemRelationRow`s with dividers. |
| `ItemRelationRow.vue` | Full-width button-row: `<icon> <label> <slot value> <chevron>`. Hover/active states. Used for all three rows. |
| `ItemParentPickerForm.vue` | Debounced item search + `ScannerPickerButton` (`accepts: ['item']`) + selected-item chip + "Очистить родителя" action. Emits `update:modelValue` on each change. |
| `ItemParentPickerDrawer.vue` | Wraps `ItemParentPickerForm` in `<Drawer>`. Holds buffered value; emits `save` on confirm button. |
| `ItemLocationPickerForm.vue` | Location-tree search + `ScannerPickerButton` (`accepts: ['location']`). No clear action (location is required). Emits `update:modelValue`. |
| `ItemLocationPickerDrawer.vue` | Wraps `ItemLocationPickerForm` in `<Drawer>`. |
| `ItemTagsPickerForm.vue` | Tag search + inline tag creation + multi-select + chip display + "Очистить все" action. Emits `update:modelValue`. |
| `ItemTagsPickerDrawer.vue` | Wraps `ItemTagsPickerForm` in `<Drawer>`. |

### Form contracts (inner layer)

Forms are controlled via `v-model` and never call the API to commit — they just maintain selection state and emit changes. Consumers decide when to commit.

```ts
// ItemParentPickerForm
defineProps<{
  modelValue: ItemSummary | null
  excludeId?: string  // current item id, prevents self-parenting
}>()
defineEmits<{
  "update:modelValue": [ItemSummary | null]
}>()

// ItemLocationPickerForm
defineProps<{ modelValue: LocationSummary | null }>()
defineEmits<{ "update:modelValue": [LocationSummary] }>()

// ItemTagsPickerForm
defineProps<{ modelValue: TagSummary[] }>()
defineEmits<{ "update:modelValue": [TagSummary[]] }>()
```

### Drawer contracts (outer layer)

Drawers buffer the Form's value internally so cancel/swipe-down does not commit. The `save` event fires only on the explicit "Сохранить" button.

```ts
// ItemParentPickerDrawer (Location/Tags analogous)
defineProps<{
  open: boolean
  value: ItemSummary | null
  excludeId?: string
}>()
defineEmits<{
  "update:open": [boolean]
  save: [ItemSummary | null]
}>()
```

Key contract decisions:

- **Form is always rendered** inside its parent's layout. No `open` prop, no Drawer wrapper. `QuickAddSheet` uses Form directly.
- **Drawer wraps Form** and adds the commit boundary. Item detail uses Drawer.
- **`save` fires only on explicit confirm** in the Drawer. Cancel / swipe-down closes without emit. Buffered state inside Drawer resets to `value` on next open.
- **`excludeId`** on parent forms filters the current item out of search results. Backend handles descendant-cycle rejection.

### `buildItemUpdate` utility

`lib/api/build-item-update.ts`:

```ts
import type { ItemOut, ItemUpdate } from "~~/lib/api/types/data-contracts"

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
  }
}
```

One canonical mapping from `ItemOut` → `ItemUpdate`. All `api.items.update` callers route through it. The fields that historically caused silent drops (`locationId` from `location.id`, `parentId` from `parent?.id`, `tagIds` from `tags`) are handled explicitly here, so callers cannot forget them.

## Data flow

### Per-relation commit, no shared edit-mode

Each row is independent. Tap → drawer → confirm in drawer → one `PUT /items/{id}` that changes only that relation. Toast "Сохранено". No global "save" button at the relations section.

Rationale: relations are three independent properties, not a form. A shared edit-mode would force the user to commit all three at once or save without changes. Per-relation commit matches the mental model "I am changing one relation".

### Handlers in `pages/items/[id].vue`

```ts
async function updateParent(newParent: ItemSummary | null) {
  if (!item.value) return
  const prev = item.value.parent
  item.value.parent = newParent  // optimistic
  try {
    const resp = await api.items.update(
      item.value.id,
      buildItemUpdate(item.value, { parentId: newParent?.id ?? null }),
    )
    if (resp.error || !resp.data) throw new Error("update failed")
    item.value = resp.data
    toast.success("Сохранено")
  } catch (e) {
    item.value.parent = prev
    await fetchItem()
    toast.error(`Не удалось сменить родителя: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function updateLocation(loc: LocationSummary) { /* analogous, locationId: loc.id */ }
async function updateTags(tags: TagSummary[]) { /* analogous, tagIds: tags.map(t => t.id) */ }
```

The optimistic update keeps the UI responsive on a local network. Rollback restores `prev` and then refetches to recover from any drift. On the existing `saveEdit` ("Детали") this same `buildItemUpdate` utility is used — which is what fixes the `parentId` regression.

## Error handling and edge cases

| Case | Behavior |
|---|---|
| `api.items.update` returns `error` or throws | Rollback `item.value.parent\|location\|tags` to `prev`, call `fetchItem()` to resync, toast `Не удалось … : <msg>`. |
| Parent picker: user picks current item | Hidden via `excludeId`. If somehow selected (race), frontend validation rejects with toast `Нельзя сделать вещь родителем самой себя`. |
| Parent picker: user picks a descendant (cycle) | Backend rejects. Frontend shows the server error via toast. No frontend detection. |
| Scanner returns id not in current search results | `ItemParentPicker` fetches via `api.items.get(target.id)`. `ItemLocationPicker` looks in the already-loaded `api.locations.getAll()` cache (matches existing `QuickAddSheet` behavior). |
| Drawer cancelled / swiped down | No `save` emit; picker state resets to `value` from props on next open. |
| `fetchItem()` runs while drawer is open | Not blocked. Last write wins on race. Acceptable for single-user app. |
| Inline tag creation fails | Toast `Не удалось создать тег`; the typed name stays in the input; nothing added to `selectedTags`. |
| `item.parent` references a deleted item | Render `parent?.name ?? "(недоступно)"` defensively. No extra fetch. |
| Empty parent / no tags | Row shows `«Без родителя»` / `«Без тегов»` in muted color. Same tap target. Tags row also shows a `+` button. |
| Location is null in `ItemOut` | Shouldn't happen (backend invariant), but render `tree.getName(id) ?? "(удалена)"` defensively. |
| Concurrent edits in same session (e.g. archive toggle + parent change) | Each call rebuilds the full `ItemUpdate` from current `item.value` plus its own override, so they don't clobber each other's fields. |

## Verification

Manual checklist run before each commit in the implementation plan:

- [ ] Tap each of the three rows → drawer opens with correct current value.
- [ ] Parent: pick item → save → row updates with name + parent's location context.
- [ ] Parent: "Очистить родителя" → row shows `«Без родителя»`; backend confirms (`item.parent === null`).
- [ ] Parent: current item does not appear in parent search results.
- [ ] Location: change location → row updates; full breadcrumb path renders via `tree.getPathString`.
- [ ] Tags: add existing tag → row updates.
- [ ] Tags: create new tag inline → tag is created and added to selection.
- [ ] Tags: remove single tag → row updates.
- [ ] Tags: "Очистить все" → row shows `«Без тегов»` + `+`.
- [ ] Scanner button works in parent picker and location picker.
- [ ] **Regression check**: edit and save "Детали" section (e.g. change description) — `item.parent` and `item.tags` are preserved on server. (This is the bug fix.)
- [ ] Optimistic rollback: disable network in DevTools → try changing parent → row rolls back, toast appears, then `fetchItem` resyncs.
- [ ] `QuickAddSheet` after migration: create an item with parent + location + tags works end-to-end.
- [ ] `QuickAddSheet`: Form components render inline without any nested `<Drawer>` (visual sanity check).

Type safety covered by `pnpm build` (TypeScript strict mode). `defineProps` / `defineEmits` give contract-level safety. Pure logic (`buildItemUpdate`) is unit-tested via vitest (`lib/api/build-item-update.test.ts`); components stay behind the manual checklist above.

## Implementation plan (commits)

One PR, four logically separated commits for review:

1. **`refactor(frontend-v2): extract buildItemUpdate utility`**
   - New `lib/api/build-item-update.ts`.
   - Refactor `saveEdit` in `pages/items/[id].vue` to use it. **This fixes the `parentId` regression.**
   - Refactor `save` in `QuickAddSheet.vue` to use it (with `parentId`, `tagIds` overrides built from local state).
   - No UI changes.

2. **`feat(frontend-v2): item relation pickers (parent/location/tags)`**
   - New `components/items/relations/ItemParentPickerForm.vue`
   - New `components/items/relations/ItemLocationPickerForm.vue`
   - New `components/items/relations/ItemTagsPickerForm.vue`
   - New `components/items/relations/ItemParentPickerDrawer.vue`
   - New `components/items/relations/ItemLocationPickerDrawer.vue`
   - New `components/items/relations/ItemTagsPickerDrawer.vue`
   - New `components/items/relations/ItemRelationsSection.vue`
   - New `components/items/relations/ItemRelationRow.vue`
   - Form logic ported from `QuickAddSheet`. Drawer = thin wrapper. Components not consumed yet.

3. **`refactor(frontend-v2): use relation picker forms in QuickAddSheet`**
   - `QuickAddSheet.vue` switches to `<ItemParentPickerForm v-model="parent">`, `<ItemLocationPickerForm v-model="location">`, `<ItemTagsPickerForm v-model="tags">`.
   - Delete the inline parent/location/tags logic (~150 lines).
   - Regression check: create flow visually identical, all fields work, scanner works.

4. **`feat(frontend-v2): item detail relations section`**
   - `pages/items/[id].vue`: delete top chip-row block (347–378), remove location field from "Детали" inline form, add `Количество` row to "Детали" read view, insert `<ItemRelationsSection>` with three handlers.
   - Three new handlers: `updateParent`, `updateLocation`, `updateTags`. Each uses `buildItemUpdate` with its override.

Each commit independently buildable, lintable, deployable.

## Risks

- **Drawer-in-drawer pitfall in `QuickAddSheet`.** Mitigated by the Form/Drawer split — `QuickAddSheet` uses `*Form` directly without any `<Drawer>` wrapper.
- **Cycle in parent assignment.** Frontend doesn't detect descendant cycles. Acceptable: backend is authoritative; toast surfaces error.
- **Optimistic update racing concurrent edits.** The `prev` captured in closure may be stale by the time a second handler runs. Mitigated by `fetchItem()` in `catch`. Worst case: brief flash of inconsistent state, then resync.
- **`syncChildItemsLocations` flag.** Preserved as-is from `item.value`. If a user wants different behavior they currently have no UI for it; this is unchanged from today and out of scope.
