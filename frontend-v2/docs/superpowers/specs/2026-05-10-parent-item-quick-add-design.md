# Parent Item field in Quick Add sheet

**Date:** 2026-05-10
**Scope:** `frontend-v2` only — frontend-only feature, no backend changes.

## Goal

Allow user to optionally nest a newly created item inside another item (parent → child relationship) directly from the quick-add form, with server-side search to find the parent.

## Background

- `components/items/QuickAddSheet.vue` is the form used to add items from the FAB.
- Backend already supports `parentId?: string | null` on `ItemCreate` (see `lib/api/types/data-contracts.ts:633`).
- Search is available via `api.items.getAll({ q, pageSize })` returning `ItemSummary[]` (each summary has `location?: LocationSummary | null`).
- Current form already implements a similar search-input + dropdown + selected-chip pattern for `locationId`.

## Placement

Inside the existing `v-if="showMore"` block (after the description field), as its own section labelled **«Родительская вещь»**.

Rationale: nesting items is an advanced/rare flow. The default path stays uncluttered; users who need it pay one extra click on «Больше подробностей».

## UI

Mirrors the existing location-picker pattern:

1. **Search input** with `Search` icon and placeholder «Поиск вещи…».
2. **Results dropdown** below the input, visible only when:
   - the search input has non-empty text, AND
   - no parent is currently selected.
   Each row shows:
   - primary line: `item.name`
   - secondary line (small, muted): `item.location?.name ?? ""` — disambiguates duplicates like multiple "Кабель" items.
   Up to 10 results.
3. **Selected chip** with an `X` button — replaces the dropdown once a parent is chosen, identical styling to the selected-location chip.
4. **States inside dropdown:**
   - empty input: dropdown not rendered.
   - request in flight: «Поиск…» row.
   - empty response: «Ничего не найдено».

## Behavior

- **Debounced search:** 300 ms debounce on `parentSearch` changes. If a parent is already selected, no search runs.
- **Race protection:** monotonic `parentReqSeq` counter; responses with a stale sequence number are dropped. No AbortController — keeps it simple.
- **Optional payload:** `parentId` is sent only when selected; otherwise the field is `undefined` and excluded from the `ItemCreate` payload.
- **Multiple-items mode** (`quantityMode === "multiple"` with N separate items): the same `parentId` is applied to every created item — typical "5 cables inside one toolbox" use case.
- **Reset:** `parentId`, `parentSearch`, `parentResults`, `selectedParent`, and `parentReqSeq` are cleared
  - on sheet close (`resetAndClose`), and
  - on "Сохранить и ещё" — next item starts with no parent. If the user wants the same parent again, they reselect.

## Implementation outline

### State (script setup)

```ts
const parentId = ref("");
const parentSearch = ref("");
const parentResults = ref<ItemSummary[]>([]);
const selectedParent = ref<ItemSummary | null>(null);
const parentLoading = ref(false);
let parentReqSeq = 0;
let parentDebounceTimer: ReturnType<typeof setTimeout> | null = null;
```

### Watcher

Watch `parentSearch`:
- if empty → clear `parentResults`, cancel pending timer, return.
- if parent already selected (`parentId.value`) → no-op (the input is hidden in this state anyway).
- otherwise debounce 300ms then call `api.items.getAll({ q, pageSize: 10 })`. Increment `parentReqSeq`, capture the local seq, drop the response if it doesn't match the current seq.

### Selection / clear

- Select: set `selectedParent = item`, `parentId = item.id`, clear `parentSearch` and `parentResults`.
- Clear: set `selectedParent = null`, `parentId = ""`.

### Payload

In both branches of `save()`:

```ts
api.items.create({
  name: name.value,
  locationId: locationId.value,
  quantity: ...,
  description: description.value,
  tagIds: [],
  parentId: parentId.value || undefined,
});
```

### Reset

`resetAndClose()` and the "save and another" branch each clear all parent-related refs.

## Out of scope

- No backend changes.
- No component test for QuickAddSheet (none exists today). Can be added later as a separate task if needed.
- No "recently used parent" memory in localStorage (parallel to `lastLocationId`). If desired later, trivial to add.
- No filter for archived items in search — backend default behavior applies.

## Files touched

- `components/items/QuickAddSheet.vue` — add state, watcher, UI section, payload field, reset hooks.

That's it — single file change.
