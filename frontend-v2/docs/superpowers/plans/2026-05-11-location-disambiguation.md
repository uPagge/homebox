# Location Disambiguation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показывать путь родителей в пикерах локаций и в бейджах, чтобы дочерние локации с одинаковыми именами были различимы.

**Architecture:** Используем существующий композабл `useLocationTree()` (`composables/use-location-tree.ts`), который уже грузит дерево локаций и отдаёт `getPathString(id) → "Кухня › Шкаф › Полка 1"`. В пикерах рендерим двустрочный пункт (имя + путь снизу); в бейджах рендерим полный путь с RTL-truncate (приём из `ItemCard.vue`).

**Tech Stack:** Vue 3 (Nuxt), TypeScript, Tailwind CSS, `useLocationTree` composable, `vitest` (есть, но компонентных тестов в проекте нет — верификация ручная через `pnpm dev`).

**Spec:** `docs/superpowers/specs/2026-05-11-location-disambiguation-design.md`

**Working directory for all commands:** `homebox/frontend-v2/`

---

## Файлы

| Файл | Что меняем |
|---|---|
| `components/items/MoveScannerSheet.vue` | Пикер «Выбрать локацию» — двустрочный |
| `components/items/BatchLocationSheet.vue` | Пикер массового перемещения — двустрочный |
| `components/items/QuickAddSheet.vue` | Пикер локации (двустрочный) + бейдж локации в `parentResults`/`selectedParent` |
| `components/items/FilterBar.vue` | Чекбоксы фильтра локации — двустрочные |
| `components/app/QuickMenuDialog.vue` | Локации в результатах поиска (двустрочно) + бейдж в карточке вещи |
| `pages/items/[id].vue` | `<option>` в `<select>` — путь строкой; чип локации — RTL-truncate path |

Уже корректны и **не трогаем**: `ItemCard.vue`, `ItemListRow.vue`, `LocationCreateSheet.vue`, `pages/locations/[id].vue`.

---

## Общий паттерн (использовать в каждом таске)

### Паттерн A — двустрочный пункт пикера

В `<script setup>` файла:

```ts
const tree = useLocationTree();
```

Шаблон пункта (адаптировать классы под существующую разметку — `<button>` или `<DropdownMenuCheckboxItem>`):

```vue
<button
  v-for="loc in filteredLocations"
  :key="loc.id"
  class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
  @click="..."
>
  <div class="flex items-baseline justify-between gap-2">
    <span class="text-sm">{{ loc.name }}</span>
    <span class="text-xs text-muted-foreground shrink-0">({{ loc.itemCount }})</span>
  </div>
  <div
    v-if="tree.getPath(loc.id) && tree.getPath(loc.id)!.length > 1"
    class="text-xs text-muted-foreground truncate"
  >
    {{ parentPathString(loc.id) }}
  </div>
</button>
```

И вспомогательная функция в `<script setup>`:

```ts
function parentPathString(id: string): string {
  const path = tree.getPath(id);
  if (!path || path.length <= 1) return "";
  return path.slice(0, -1).map(p => p.name).join(" › ");
}
```

`tree.getPath()` возвращает массив `[...ancestors, self]`, поэтому `slice(0, -1)` — это «только родители». Если у локации нет родителей, или дерево ещё не загрузилось — путь не рисуем (`v-if`).

### Паттерн B — бейдж локации

В `<script setup>`:

```ts
const tree = useLocationTree();
```

Заменить `{{ item.location.name }}` на:

```vue
<bdi
  class="truncate text-start"
  style="direction: rtl"
  :title="tree.getPathString(item.location.id) ?? item.location.name"
>{{ tree.getPathString(item.location.id) ?? item.location.name }}</bdi>
```

Если место уже было `<span>` без `truncate` — обернуть в контейнер с `min-w-0` так же, как сделано в `ItemCard.vue:90-99`.

Для коротких/inline-бейджей, где `<bdi>` визуально неуместен, можно использовать просто строку `tree.getPathString(...) ?? item.location.name` без RTL-приёма (например, `selectedParent` в QuickAddSheet — короткая inline-метка).

### Паттерн C — нативный `<select>`

Просто заменить `loc.name` на путь:

```vue
<option v-for="loc in allLocations" :key="loc.id" :value="loc.id">
  {{ tree.getPathString(loc.id) ?? loc.name }}
</option>
```

---

## Task 1: MoveScannerSheet — пикер «Выбрать локацию»

**Files:**
- Modify: `components/items/MoveScannerSheet.vue:372-380`

- [ ] **Step 1: Импортировать tree composable**

В `<script setup>` (после строки `const session = useMoveSession();` или рядом):

```ts
const tree = useLocationTree();
```

И добавить функцию рядом с `filteredLocations`:

```ts
function parentPathString(id: string): string {
  const path = tree.getPath(id);
  if (!path || path.length <= 1) return "";
  return path.slice(0, -1).map(p => p.name).join(" › ");
}
```

- [ ] **Step 2: Заменить разметку пункта пикера**

Найти блок `<button v-for="loc in filteredLocations"` (около строки 372) и заменить на:

```vue
<button
  v-for="loc in filteredLocations"
  :key="loc.id"
  class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
  @click="pickLocation(loc)"
>
  <div class="flex items-baseline justify-between gap-2">
    <span class="text-sm">{{ loc.name }}</span>
    <span class="text-xs text-muted-foreground shrink-0">({{ loc.itemCount }})</span>
  </div>
  <div
    v-if="parentPathString(loc.id)"
    class="text-xs text-muted-foreground truncate"
  >
    {{ parentPathString(loc.id) }}
  </div>
</button>
```

- [ ] **Step 3: Запустить typecheck**

```bash
pnpm exec nuxt typecheck
```

Expected: no errors related to this file. (В проекте могут быть существующие ошибки в других файлах — игнорируем, смотрим только что не появились новые.)

- [ ] **Step 4: Ручная проверка**

```bash
pnpm dev
```

Открыть приложение, открыть сканер перемещения (значок сканера на тулбаре), нажать «Выбрать локацию», ввести поиск. Убедиться, что под именем виден путь родителей у дочерних локаций, и нет под топовыми.

- [ ] **Step 5: Commit**

```bash
git add components/items/MoveScannerSheet.vue
git commit -m "$(cat <<'EOF'
fix(frontend-v2): show parent path in move scanner location picker

Locations with duplicate child names (e.g. "Полка 1" in different
shelves) are now distinguishable — the parent path is shown under the
name in the location picker.
EOF
)"
```

---

## Task 2: BatchLocationSheet — пикер массового перемещения

**Files:**
- Modify: `components/items/BatchLocationSheet.vue:88-97`

- [ ] **Step 1: Импортировать tree composable**

В `<script setup>` после `const api = useUserApi();` добавить:

```ts
const tree = useLocationTree();

function parentPathString(id: string): string {
  const path = tree.getPath(id);
  if (!path || path.length <= 1) return "";
  return path.slice(0, -1).map(p => p.name).join(" › ");
}
```

- [ ] **Step 2: Заменить разметку пункта пикера**

Найти `<button v-for="loc in filteredLocations"` (около строки 88) и заменить на:

```vue
<button
  v-for="loc in filteredLocations"
  :key="loc.id"
  class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
  :class="loc.id === locationId ? 'bg-primary/10 text-primary font-medium' : ''"
  @click="locationId = loc.id; locationSearch = ''"
>
  <div class="flex items-baseline justify-between gap-2">
    <span class="text-sm">{{ loc.name }}</span>
    <span class="text-xs text-muted-foreground shrink-0">({{ loc.itemCount }})</span>
  </div>
  <div
    v-if="parentPathString(loc.id)"
    class="text-xs text-muted-foreground truncate"
  >
    {{ parentPathString(loc.id) }}
  </div>
</button>
```

Также обновить `selectedLocationName` чтобы тоже учитывал путь (для placeholder и chip):

Найти:
```ts
const selectedLocationName = computed(() =>
  locations.value.find(l => l.id === locationId.value)?.name ?? ""
);
```

Заменить на:
```ts
const selectedLocationName = computed(() => {
  const loc = locations.value.find(l => l.id === locationId.value);
  if (!loc) return "";
  return tree.getPathString(loc.id) ?? loc.name;
});
```

- [ ] **Step 3: Запустить typecheck**

```bash
pnpm exec nuxt typecheck
```

Expected: no new errors.

- [ ] **Step 4: Ручная проверка**

В UI: выбрать 2+ вещи (selection mode), нажать «Переместить», ввести поиск локации. Проверить двустрочный рендер. После выбора локации проверить chip с выбранной (`selectedLocationName`) — там должен быть полный путь.

- [ ] **Step 5: Commit**

```bash
git add components/items/BatchLocationSheet.vue
git commit -m "$(cat <<'EOF'
fix(frontend-v2): show parent path in batch move location picker

Same disambiguation fix as the move scanner picker, applied to the
batch-move sheet used when moving multiple selected items.
EOF
)"
```

---

## Task 3: FilterBar — чекбоксы фильтра локации

**Files:**
- Modify: `components/items/FilterBar.vue:70-78`

- [ ] **Step 1: Импортировать tree composable**

В `<script setup>` после `const api = useUserApi();` добавить:

```ts
const tree = useLocationTree();

function parentPathString(id: string): string {
  const path = tree.getPath(id);
  if (!path || path.length <= 1) return "";
  return path.slice(0, -1).map(p => p.name).join(" › ");
}
```

Также обновить `locationName` — для chip в шапке тоже хотим путь:

```ts
function locationName(id: string) {
  return tree.getPathString(id) ?? locations.value.find(l => l.id === id)?.name ?? "...";
}
```

- [ ] **Step 2: Заменить разметку DropdownMenuCheckboxItem**

Найти блок `<DropdownMenuCheckboxItem v-for="loc in locations"` (около строки 70) и заменить на:

```vue
<DropdownMenuCheckboxItem
  v-for="loc in locations"
  :key="loc.id"
  :checked="selectedLocations.includes(loc.id)"
  @select="(e: Event) => { e.preventDefault(); emit('toggleLocation', loc.id); }"
>
  <div class="flex flex-col min-w-0">
    <div class="flex items-baseline justify-between gap-2">
      <span class="text-sm truncate">{{ loc.name }}</span>
      <span class="text-xs text-muted-foreground shrink-0">{{ loc.itemCount }}</span>
    </div>
    <span
      v-if="parentPathString(loc.id)"
      class="text-xs text-muted-foreground truncate"
    >
      {{ parentPathString(loc.id) }}
    </span>
  </div>
</DropdownMenuCheckboxItem>
```

- [ ] **Step 3: Запустить typecheck**

```bash
pnpm exec nuxt typecheck
```

Expected: no new errors.

- [ ] **Step 4: Ручная проверка**

На странице `/items` нажать на чип «Location». В выпадашке у каждой локации с родителем виден путь снизу. После выбора локации сам chip показывает «...полка 1» или полный путь.

- [ ] **Step 5: Commit**

```bash
git add components/items/FilterBar.vue
git commit -m "$(cat <<'EOF'
fix(frontend-v2): show parent path in items filter location picker

Filter chip dropdown and the active filter chip now both show the full
location path, so duplicate child names can be told apart.
EOF
)"
```

---

## Task 4: QuickMenuDialog — поиск локаций + бейдж локации у вещей

**Files:**
- Modify: `components/app/QuickMenuDialog.vue:130-148`

- [ ] **Step 1: Импортировать tree composable**

В `<script setup>` после `const router = useRouter();` добавить:

```ts
const tree = useLocationTree();

function parentPathString(id: string): string {
  const path = tree.getPath(id);
  if (!path || path.length <= 1) return "";
  return path.slice(0, -1).map(p => p.name).join(" › ");
}
```

- [ ] **Step 2: Обновить бейдж локации у вещей**

Найти блок (около строки 130):
```vue
<span v-if="item.location" class="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">
  {{ item.location.name }}
</span>
```

Заменить на:
```vue
<bdi
  v-if="item.location"
  class="ml-auto text-xs text-muted-foreground truncate max-w-[160px] text-start"
  style="direction: rtl"
  :title="tree.getPathString(item.location.id) ?? item.location.name"
>{{ tree.getPathString(item.location.id) ?? item.location.name }}</bdi>
```

- [ ] **Step 3: Обновить пункт в результатах локаций**

Найти блок `<CommandItem v-for="loc in searchLocations"` (около строки 138) и заменить содержимое на:

```vue
<CommandItem
  v-for="loc in searchLocations"
  :key="loc.id"
  :value="`loc-${loc.id}`"
  @select="go(`/locations/${loc.id}`)"
>
  <MapPin class="mr-2 h-4 w-4 text-muted-foreground" />
  <div class="flex flex-col min-w-0 flex-1">
    <span class="truncate">{{ loc.name }}</span>
    <span
      v-if="parentPathString(loc.id)"
      class="text-xs text-muted-foreground truncate"
    >
      {{ parentPathString(loc.id) }}
    </span>
  </div>
  <span class="ml-auto text-xs text-muted-foreground">{{ loc.itemCount }}</span>
</CommandItem>
```

- [ ] **Step 4: Запустить typecheck**

```bash
pnpm exec nuxt typecheck
```

Expected: no new errors.

- [ ] **Step 5: Ручная проверка**

Открыть Ctrl+K (или Cmd+K), ввести «полка». В секции «Локации» каждый пункт с родителем имеет путь снизу. В секции «Вещи» бейдж локации справа использует RTL-truncate и показывает полный путь в tooltip.

- [ ] **Step 6: Commit**

```bash
git add components/app/QuickMenuDialog.vue
git commit -m "$(cat <<'EOF'
fix(frontend-v2): show parent path in quick menu locations and item badges

In the global search dialog (Ctrl+K), location search results now show
the parent path under the name, and the inline location badge on item
results uses the same RTL-truncate pattern as ItemCard so the leaf
location stays visible.
EOF
)"
```

---

## Task 5: QuickAddSheet — пикер локации + бейджи в parent search

**Files:**
- Modify: `components/items/QuickAddSheet.vue:331-339, 540-570`

- [ ] **Step 1: Импортировать tree composable**

В `<script setup>` найти секцию `// Locations with search` (около строки 49) и добавить ниже:

```ts
const tree = useLocationTree();

function parentPathString(id: string): string {
  const path = tree.getPath(id);
  if (!path || path.length <= 1) return "";
  return path.slice(0, -1).map(p => p.name).join(" › ");
}
```

Также обновить `selectedLocationName`:

Найти:
```ts
const selectedLocationName = computed(() => {
  const loc = locations.value.find(l => l.id === locationId.value);
  return loc?.name ?? "";
});
```

Заменить на:
```ts
const selectedLocationName = computed(() => {
  const loc = locations.value.find(l => l.id === locationId.value);
  if (!loc) return "";
  return tree.getPathString(loc.id) ?? loc.name;
});
```

- [ ] **Step 2: Обновить пункт пикера локации**

Найти блок `<button v-for="loc in filteredLocations"` (около строки 331) и заменить на:

```vue
<button
  v-for="loc in filteredLocations"
  :key="loc.id"
  class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
  :class="loc.id === locationId ? 'bg-primary/10 text-primary font-medium' : ''"
  @click="locationId = loc.id; locationSearch = ''"
>
  <div class="text-sm">{{ loc.name }}</div>
  <div
    v-if="parentPathString(loc.id)"
    class="text-xs text-muted-foreground truncate"
  >
    {{ parentPathString(loc.id) }}
  </div>
</button>
```

- [ ] **Step 3: Обновить бейджи локации в parent search и selectedParent**

Найти блок (около строки 542-545):
```vue
<div class="text-sm">{{ item.name }}</div>
<div v-if="item.location?.name" class="text-xs text-muted-foreground">
  {{ item.location.name }}
</div>
```

Заменить на:
```vue
<div class="text-sm">{{ item.name }}</div>
<div v-if="item.location" class="text-xs text-muted-foreground truncate">
  {{ tree.getPathString(item.location.id) ?? item.location.name }}
</div>
```

Найти блок (около строки 558-563):
```vue
<span class="flex-1 truncate">
  {{ selectedParent.name }}
  <span v-if="selectedParent.location?.name" class="text-muted-foreground">
    · {{ selectedParent.location.name }}
  </span>
</span>
```

Заменить на:
```vue
<span class="flex-1 truncate">
  {{ selectedParent.name }}
  <span v-if="selectedParent.location" class="text-muted-foreground">
    · {{ tree.getPathString(selectedParent.location.id) ?? selectedParent.location.name }}
  </span>
</span>
```

- [ ] **Step 4: Запустить typecheck**

```bash
pnpm exec nuxt typecheck
```

Expected: no new errors.

- [ ] **Step 5: Ручная проверка**

Открыть быстрое создание вещи (FAB → Вещь). В пикере локации проверить двустрочный рендер. В блоке «Больше подробностей → Родительская вещь» ввести поиск, выбрать parent вещь — у parent должен показаться полный путь её локации (после ·).

- [ ] **Step 6: Commit**

```bash
git add components/items/QuickAddSheet.vue
git commit -m "$(cat <<'EOF'
fix(frontend-v2): show parent path in quick-add location picker and parent badges

Both the location picker and the parent-item search results inside the
quick-add sheet now render the full location path, so duplicate child
names are no longer ambiguous when creating a new item.
EOF
)"
```

---

## Task 6: pages/items/[id].vue — `<select>` локации + чип локации в шапке

**Files:**
- Modify: `pages/items/[id].vue:312-315, 358-360`

- [ ] **Step 1: Импортировать tree composable**

В `<script setup>` найти `const api = useUserApi();` (или похожее место в начале) и добавить рядом:

```ts
const tree = useLocationTree();
```

- [ ] **Step 2: Обновить чип локации в шапке вещи**

Найти блок (около строки 312):
```vue
<div v-if="item.location" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs">
  <MapPin class="w-3.5 h-3.5" />
  {{ item.location.name }}
</div>
```

Заменить на:
```vue
<NuxtLink
  v-if="item.location"
  :to="`/locations/${item.location.id}`"
  :title="tree.getPathString(item.location.id) ?? item.location.name"
  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs hover:bg-accent hover:text-accent-foreground transition-colors max-w-[60vw] min-w-0"
>
  <MapPin class="w-3.5 h-3.5 shrink-0" />
  <bdi class="truncate text-start" style="direction: rtl">{{ tree.getPathString(item.location.id) ?? item.location.name }}</bdi>
</NuxtLink>
```

Превратили в ссылку на локацию (симметрично соседнему `parent` чипу) и добавили truncate с RTL-приёмом, чтобы длинный путь читался с правого края.

- [ ] **Step 3: Обновить `<option>` в `<select>` локации**

Найти блок (около строки 358):
```vue
<option v-for="loc in allLocations" :key="loc.id" :value="loc.id">
  {{ loc.name }}
</option>
```

Заменить на:
```vue
<option v-for="loc in allLocations" :key="loc.id" :value="loc.id">
  {{ tree.getPathString(loc.id) ?? loc.name }}
</option>
```

- [ ] **Step 4: Запустить typecheck**

```bash
pnpm exec nuxt typecheck
```

Expected: no new errors.

- [ ] **Step 5: Ручная проверка**

Открыть страницу любой вещи, лежащей в дочерней локации с конфликтным именем. В шапке чип локации показывает «...› Полка 1»; tooltip — полный путь; клик переходит на страницу локации. Раскрыть «Детали → Карандаш редактирования → Место» — в `<select>` опции показаны полным путём.

- [ ] **Step 6: Commit**

```bash
git add pages/items/[id].vue
git commit -m "$(cat <<'EOF'
fix(frontend-v2): show parent path in item page location chip and edit select

The location chip in the item header now shows the full path with RTL
truncate (matching ItemCard) and links to the location page. The
location <select> in inline edit mode lists full paths so duplicate
child names are distinguishable.
EOF
)"
```

---

## Task 7: Финальная сквозная верификация

**Files:** none — только проверка.

- [ ] **Step 1: Подготовить данные**

Если ещё нет — создать в приложении две локации с одинаковыми дочерними именами:

- Кухня → Шкаф → Полка 1
- Кладовка → Полка 1

И положить в каждую по одной вещи (можно через FAB → Вещь).

- [ ] **Step 2: Сборка**

```bash
pnpm build
```

Expected: success. (Если фейл — посмотреть лог, проверить что не сломались импорты.)

- [ ] **Step 3: Пройти по сценариям**

Запустить:
```bash
pnpm dev
```

Пройти все 6 точек по чек-листу (соответствует Verification из спеки):

| # | Сценарий | Что проверить |
|---|---|---|
| 1 | Move scanner → Выбрать локацию | «Полка 1» появляется дважды, под каждой свой путь («Кухня › Шкаф» / «Кладовка») |
| 2 | Выделить 2 вещи → Переместить | То же в BatchLocationSheet |
| 3 | FAB → Вещь → пикер локации | То же в QuickAddSheet, плюс — выбрать parent вещь: под её именем показывается полный путь её локации |
| 4 | /items → чип Location | Двустрочный рендер в выпадашке; chip после выбора — путь |
| 5 | Ctrl+K → ввести «полка» | В секции «Локации» — двустрочно; в секции «Вещи» — бейдж локации справа truncate'ит с конца, tooltip — полный путь |
| 6 | Открыть вещь → шапка/детали | Чип в шапке — truncate путь, tooltip; редактирование `<select>` — option = путь |

- [ ] **Step 4: Если всё ок — финальный коммит-таг**

Если нашёл регрессии — фиксить amend в соответствующий коммит из тасок 1-6.

Если всё чисто — никаких дополнительных коммитов. Закончено.

---

## Notes

- **Не трогаем бэкенд** (см. CLAUDE.md auto-memory `feedback-fork-isolation.md`).
- **Работаем в основном чекауте, не в worktree** (см. `feedback-no-worktrees.md`).
- Шесть коммитов — по одному на файл. Это компактнее, чем 9 (по точкам), и логичнее, чем 2 (по типу), потому что три файла (`QuickAddSheet`, `QuickMenuDialog`, `pages/items/[id].vue`) меняются и по пикеру, и по бейджу одновременно.
- Композабл `useLocationTree()` — singleton: повторные `useLocationTree()` в новых местах НЕ дублируют fetch.
- `getPath()` уже корректно отдаёт `[...ancestors, self]`, поэтому `slice(0, -1)` — гарантированно «только родители».
- Параметр `tree.getPath(loc.id)` может вернуть `null`, если дерево ещё грузится — в этот момент `parentPathString` вернёт пустую строку, и `v-if` спрячет вторую строку. После загрузки рендер обновится реактивно.
