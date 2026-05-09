# Global Search & Batch Operations Design

## Goal

Add Cmd+K command palette with live search across items/locations/tags, and batch operations for items (change location, add/remove tags, duplicate, delete).

## Architecture

Frontend-only changes. No backend modifications. Batch operations use sequential single-item API calls (ItemPatch/delete/duplicate) — same approach as original frontend due to SQLite concurrency limitations. In-use status implemented via regular tags (no special backend support needed).

## Tech Stack

- Reka-UI ComboboxRoot (existing command palette components)
- Existing Dialog Provider system with DialogID.QuickMenu
- Vue 3 composables for selection state
- Existing ItemsAPI (patch, delete, duplicate)

---

## 1. Global Search (Cmd+K Command Palette)

### Trigger

- Click on SearchBar component (sidebar + mobile header)
- Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows)
- Uses `useDialogHotkey(DialogID.QuickMenu, { code: "KeyK", meta: true })`

### UI Structure

CommandDialog with CommandInput at top. Three groups below:

**Group "Поиск" (dynamic, shown when query is non-empty):**
- Live search with 200ms debounce
- Parallel API calls: `api.items.getAll({ q })`, `api.locations.getAll()` filtered client-side, `api.tags.getAll()` filtered client-side
- Up to 5 results per category
- Each result shows: icon (Package/MapPin/Tag), name, subtitle (location for items, item count for locations/tags)
- Click → `navigateTo()` to detail page, dialog closes

**Group "Создать" (static, always shown):**
- Вещь → opens QuickAddSheet (activeCreate = 'item')
- Локация → opens LocationCreateSheet (activeCreate = 'location')
- Тег → opens LabelCreateSheet (activeCreate = 'label')

**Group "Перейти" (static, always shown):**
- Главная, Предметы, Локации, Теги, Обслуживание, Настройки
- Click → navigateTo(), dialog closes

### Components

- `components/app/QuickMenuDialog.vue` — main component
- `components/app/SearchBar.vue` — updated to open QuickMenu via useDialog()

### Integration

- Rendered in `layouts/default.vue`
- Create actions reuse existing `activeCreate` ref from layout
- SearchBar updated to call `openDialog(DialogID.QuickMenu)` instead of emitting click

---

## 2. Batch Operations

### Selection Mode

**Activation:**
- Button "Выбрать" in items page toolbar (next to grid/table view toggle)
- Toggles `selectionMode` ref
- ESC exits selection mode and clears selection

**Visual changes in selection mode:**
- Checkboxes appear on ItemCard (top-left corner overlay) and ItemListRow (first column)
- "Select all on page" checkbox in header area
- Cards/rows clickable for toggle (not navigation) while in selection mode
- Selected items get `ring-2 ring-primary` highlight

**State management:**
- `selectedIds: Set<string>` ref in items page
- Cleared on page change, filter change, or mode exit

### Sticky Action Bar

**Position:** Fixed bottom, above BottomTabs on mobile, above page bottom on desktop. z-index above content but below drawers.

**Content:**
- Left: "Выбрано: N" counter
- Right: action buttons with icons
  - MapPin → Переместить (change location)
  - TagPlus → Тег+ (add tags)
  - TagMinus → Тег− (remove tags)
  - Copy → Дублировать
  - Trash2 → Удалить (destructive style)

**Component:** `components/items/SelectionBar.vue`

### Batch Dialogs

All dialogs use Drawer (vaul-vue) for consistency with rest of app.

**BatchLocationDialog:**
- Searchable location list (same pattern as QuickAddSheet location picker)
- "Применить" button
- On confirm: sequential `api.items.patch(id, { locationId })` for each selected item
- Progress: "Обновлено N из M"

**BatchTagDialog:**
- Props: `mode: 'add' | 'remove'`
- Add mode: show all tags, multi-select checkboxes
- Remove mode: show only tags present on at least one selected item (union), multi-select
- On confirm: for each item, compute new tagIds (original + added - removed), then `api.items.patch(id, { tagIds })`
- Progress indicator

**BatchDeleteDialog:**
- Confirmation text: "Удалить N вещей? Это действие нельзя отменить."
- "Удалить" button (destructive)
- Sequential `api.items.delete(id)`
- Progress indicator

**BatchDuplicateDialog:**
- Confirmation text: "Дублировать N вещей?"
- Sequential `api.items.duplicate(id)`
- Progress indicator

### Error Handling

- If any operation fails mid-batch: show toast with error, continue with remaining items
- After batch completes: show summary toast "Обновлено N из M" (or "Удалено", "Дублировано")
- Refresh item list after batch completes
- Exit selection mode after successful batch

---

## 3. In-Use Status

No special implementation. User creates a tag (e.g. "В использовании") and manages it via:
- Individual item editing
- Batch tag operations (select items → Тег+ → "В использовании")
- Filtering by tag on items page already works

---

## File Structure

### New Files
```
components/
  app/QuickMenuDialog.vue          — Command palette with search
  items/SelectionBar.vue           — Sticky bottom action bar
  items/BatchLocationDialog.vue    — Location change drawer
  items/BatchTagDialog.vue         — Add/remove tags drawer
  items/BatchDeleteDialog.vue      — Delete confirmation drawer
  items/BatchDuplicateDialog.vue   — Duplicate confirmation drawer
```

### Modified Files
```
layouts/default.vue                — Add QuickMenuDialog
components/app/SearchBar.vue       — Open QuickMenu via dialog provider
pages/items/index.vue              — Selection mode, SelectionBar, batch state
components/items/ItemCard.vue      — Checkbox overlay in selection mode
components/items/ItemListRow.vue   — Checkbox column in selection mode
```

---

## UX Details

- Batch operations process items sequentially (not parallel) to avoid SQLite locking
- Progress shown during batch operations — user sees "N из M" counter
- All batch dialogs are Drawers (mobile-first, consistent with create sheets)
- Selection persists within current page/filters, cleared on navigation
- Cmd+K works from any page (rendered in layout)
- SearchBar visual appearance unchanged — still shows ⌘K hint
