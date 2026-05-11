# Smart Back Button on Item Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На странице `/items/[id]` кнопка «Назад» помнит исходную локацию через `?from=<locationId>` и подписывается её именем, чтобы возврат в исходную локацию работал после переноса айтема.

**Architecture:** Чистый хелпер `resolveItemBackTarget` инкапсулирует логику резолва (id → имя/URL/фолбэк). `ItemCard` и `ItemListRow` дописывают `?from=` в `NuxtLink`, когда задан `currentLocationId`. Страница айтема использует хелпер и рендерит динамическую кнопку.

**Tech Stack:** Nuxt 3, Vue 3 (Composition API), TypeScript, vitest (node env), `useLocationTree` composable.

**Spec:** `docs/superpowers/specs/2026-05-11-smart-item-back-button-design.md`

---

## File Structure

| Файл | Ответственность | Действие |
|---|---|---|
| `composables/use-item-back-target.ts` | Чистая функция `resolveItemBackTarget(from, getName)` — преобразует query-параметр в `{ label, to }` | Create |
| `composables/use-item-back-target.test.ts` | Покрытие хелпера vitest-тестами (все ветки из таблицы спеки) | Create |
| `pages/items/[id].vue` | Читает `route.query.from`, дергает хелпер, рендерит кнопку с лейблом/таргетом | Modify (lines 270-276 + script) |
| `components/items/ItemCard.vue` | Расширяет `:to` до `{ path, query: { from } }`, если `currentLocationId` задан | Modify (line 45) |
| `components/items/ItemListRow.vue` | То же | Modify (line 45) |

---

## Task 1: Helper `resolveItemBackTarget` + тесты

**Files:**
- Create: `composables/use-item-back-target.ts`
- Test: `composables/use-item-back-target.test.ts`

Хелпер чистый, не использует Vue runtime — поэтому тестируется на node-environment vitest как `use-location-name-suggest.test.ts`.

**Контракт:**

```ts
type BackTarget = {
  label: string;      // что показать рядом со стрелкой (без самой стрелки)
  to: string | null;  // путь для router.push; null → использовать router.back()
};

function resolveItemBackTarget(
  from: string | undefined,
  getName: (id: string) => string | null
): BackTarget
```

**Ветки:**
1. `from === undefined` → `{ label: "Назад", to: null }` — фолбэк на `router.back()`.
2. `from === ""` → то же, что undefined (пустая строка трактуется как «нет origin»).
3. `from = "A"`, `getName("A") === null` → `{ label: "Назад", to: "/locations/A" }` — id есть, имя не загрузилось; всё равно знаем куда идти.
4. `from = "A"`, `getName("A") === "Кухня"` → `{ label: "Кухня", to: "/locations/A" }`.

- [ ] **Step 1: Создать файл с тестами (red)**

Записать `composables/use-item-back-target.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { resolveItemBackTarget } from "./use-item-back-target";

const namedTree = (map: Record<string, string>) => (id: string) => map[id] ?? null;
const emptyTree = () => null;

describe("resolveItemBackTarget", () => {
  test("no from → fallback label, null target", () => {
    expect(resolveItemBackTarget(undefined, emptyTree)).toEqual({
      label: "Назад",
      to: null,
    });
  });

  test("empty from → same as undefined", () => {
    expect(resolveItemBackTarget("", emptyTree)).toEqual({
      label: "Назад",
      to: null,
    });
  });

  test("from present, name unknown → fallback label, target by id", () => {
    expect(resolveItemBackTarget("A", emptyTree)).toEqual({
      label: "Назад",
      to: "/locations/A",
    });
  });

  test("from present, name known → location name as label", () => {
    const getName = namedTree({ A: "Кухня" });
    expect(resolveItemBackTarget("A", getName)).toEqual({
      label: "Кухня",
      to: "/locations/A",
    });
  });

  test("from present with non-ascii id (uuid-like) → composed path is correct", () => {
    const getName = namedTree({ "abc-123": "Гараж" });
    expect(resolveItemBackTarget("abc-123", getName)).toEqual({
      label: "Гараж",
      to: "/locations/abc-123",
    });
  });
});
```

- [ ] **Step 2: Прогнать тесты — должны упасть**

Запустить: `pnpm test composables/use-item-back-target.test.ts`

Ожидание: ошибка импорта `resolveItemBackTarget` (файла нет).

- [ ] **Step 3: Реализовать хелпер**

Записать `composables/use-item-back-target.ts`:

```ts
export type BackTarget = {
  label: string;
  to: string | null;
};

const FALLBACK_LABEL = "Назад";

export function resolveItemBackTarget(
  from: string | undefined,
  getName: (id: string) => string | null,
): BackTarget {
  if (!from) {
    return { label: FALLBACK_LABEL, to: null };
  }
  const name = getName(from);
  return {
    label: name ?? FALLBACK_LABEL,
    to: `/locations/${from}`,
  };
}
```

- [ ] **Step 4: Прогнать тесты — должны пройти**

Запустить: `pnpm test composables/use-item-back-target.test.ts`

Ожидание: все 5 кейсов проходят.

- [ ] **Step 5: Прогнать весь test-suite чтобы убедиться что ничего не сломали**

Запустить: `pnpm test`

Ожидание: все существующие тесты проходят как раньше + 5 новых.

- [ ] **Step 6: Коммит**

```bash
git add composables/use-item-back-target.ts composables/use-item-back-target.test.ts
git commit -m "feat(frontend-v2): add resolveItemBackTarget helper for item back button"
```

---

## Task 2: Использовать хелпер на странице айтема

**Files:**
- Modify: `pages/items/[id].vue` (lines 13-17 script setup; lines 270-276 template)

Сейчас:
- `pages/items/[id].vue:13` уже создаёт `const route = useRoute()` и `const tree = useLocationTree()`.
- `pages/items/[id].vue:270-276` — кнопка «Назад» с фиксированной подписью и `router.back()`.

Превратить кнопку в conditional: если у нас есть `to` — рендерим `NuxtLink`, иначе — `button` с `router.back()`.

- [ ] **Step 1: Добавить reactive backTarget в script**

В `pages/items/[id].vue`, после строки `const tree = useLocationTree();` (около строки 16), добавить:

```ts
const backTarget = computed(() =>
  resolveItemBackTarget(
    typeof route.query.from === "string" ? route.query.from : undefined,
    (id) => tree.getName(id),
  ),
);
```

Импорт автоимпортится из `composables/` через Nuxt, добавлять ручной import не нужно (проверить: в файле нет других ручных import'ов из `~/composables`).

- [ ] **Step 2: Заменить кнопку в template (lines 270-276)**

Старое:

```vue
<button
  class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
  @click="router.back()"
>
  <ArrowLeft class="w-4 h-4" />
  Назад
</button>
```

Новое:

```vue
<NuxtLink
  v-if="backTarget.to"
  :to="backTarget.to"
  class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0 max-w-full"
>
  <ArrowLeft class="w-4 h-4 shrink-0" />
  <span class="truncate">{{ backTarget.label }}</span>
</NuxtLink>
<button
  v-else
  class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
  @click="router.back()"
>
  <ArrowLeft class="w-4 h-4" />
  {{ backTarget.label }}
</button>
```

`truncate` нужен для длинных имён локаций (могут быть «Гараж / Стеллаж / Полка 3»).

- [ ] **Step 3: Запустить dev и убедиться что страница не падает**

Запустить: `pnpm dev`

Открыть `/items/<любой-id>` напрямую (без `?from=`). Ожидание: видна кнопка «← Назад», клик уводит назад (или на пустую страницу, если истории нет — это ОК, такое поведение и было).

- [ ] **Step 4: Type-check**

Запустить: `pnpm exec vue-tsc --noEmit`

Ожидание: 0 ошибок.

- [ ] **Step 5: Коммит**

```bash
git add pages/items/[id].vue
git commit -m "feat(frontend-v2): wire smart back button on item page

Reads ?from=<locationId> query param and resolves to a NuxtLink
labeled with the origin location name. Falls back to router.back()
when no origin is present."
```

---

## Task 3: Пробросить `?from=` из ItemCard и ItemListRow

**Files:**
- Modify: `components/items/ItemCard.vue:45`
- Modify: `components/items/ItemListRow.vue:45`

Сейчас оба компонента строят `:to="`/items/${item.id}`"`. Заменить на объект, который условно добавляет `query.from`, когда задан `currentLocationId`.

- [ ] **Step 1: ItemCard — заменить `:to`**

В `components/items/ItemCard.vue:45`:

Старое:

```vue
<NuxtLink
  :to="selectionMode ? undefined : `/items/${item.id}`"
  ...
```

Новое:

```vue
<NuxtLink
  :to="selectionMode ? undefined : {
    path: `/items/${item.id}`,
    query: currentLocationId ? { from: currentLocationId } : undefined,
  }"
  ...
```

Если `currentLocationId` undefined — query не добавляется, URL остаётся `/items/<id>` (никакого `?from=` хвоста).

- [ ] **Step 2: ItemListRow — тот же патч**

В `components/items/ItemListRow.vue:45`:

Старое:

```vue
<NuxtLink
  :to="selectionMode ? undefined : `/items/${item.id}`"
  ...
```

Новое:

```vue
<NuxtLink
  :to="selectionMode ? undefined : {
    path: `/items/${item.id}`,
    query: currentLocationId ? { from: currentLocationId } : undefined,
  }"
  ...
```

- [ ] **Step 3: Дев-проверка happy path**

`pnpm dev` запущен (Task 2, Step 3). Если нет — `pnpm dev`.

В браузере:
1. Открыть `/locations/<какая-нибудь>` где есть вещи.
2. Кликнуть карточку (card view) — URL должен стать `/items/<id>?from=<locationId>`, кнопка «Назад» подписана именем локации.
3. Кликнуть кнопку → возврат на `/locations/<locationId>`.
4. Переключить view на List, кликнуть строку — то же поведение.
5. Открыть `/items/<id>` напрямую (без query) — кнопка «← Назад», клик `router.back()`.

- [ ] **Step 4: Дев-проверка ключевого фикса**

В браузере:
1. Открыть `/locations/A` (любую с вещью).
2. Кликнуть вещь X — оказались на `/items/X?from=A`, кнопка подписана «← <имя A>».
3. Сменить локацию X через инлайн-edit на B, сохранить.
4. Кнопка по-прежнему подписана «← <имя A>», клик → `/locations/A`. ✓
5. Аналогично: открыть X (with `?from=A`), нажать «Переместить», в сканере выбрать B. Кнопка по-прежнему ведёт в A.

- [ ] **Step 5: Дев-проверка фолбэка**

1. Открыть `/items/<id>?from=ghost-id-that-doesnt-exist`.
2. Кнопка должна показывать «← Назад» (fallback label), клик ведёт на `/locations/ghost-id-that-doesnt-exist` (404 локации — это ОК, это деградация по спеке).
3. Проверить, что в DevTools console нет ошибок Vue.

- [ ] **Step 6: Type-check + общий test-suite**

Запустить параллельно:

```bash
pnpm exec vue-tsc --noEmit
pnpm test
```

Ожидание: оба зелёные.

- [ ] **Step 7: Коммит**

```bash
git add components/items/ItemCard.vue components/items/ItemListRow.vue
git commit -m "feat(frontend-v2): pass ?from=<locationId> from item cards/rows

Lets the smart back button on the item page return to the origin
location even after the item has been moved elsewhere."
```

---

## Self-Review Checklist

Перед сдачей:

- [ ] Все 3 ветки чек-листа спеки покрыты (`from` нет / `from` есть без имени / `from` есть с именем). ✓ — тесты в Task 1.
- [ ] Ключевой фикс (`from` не меняется после переноса) проверен вручную в Task 3 Step 4. ✓
- [ ] Нет ручных правок `pages/locations/[id].vue` — `currentLocationId` уже передаётся в карточки (lines 438, 452). ✓
- [ ] Не трогали `MoveScannerSheet`, `BatchLocationSheet` — они не уходят со страницы.
- [ ] Не пробрасываем `from` через parent-чип айтема (`pages/items/[id].vue:304-312`) — там фолбэк на `router.back()` достаточен.
- [ ] Type-check зелёный.
- [ ] Все тесты проходят.

## Out-of-the-way

- Никаких новых API-вызовов.
- Никаких изменений в `MoveScannerSheet`, `BatchLocationSheet`, `pages/locations/[id].vue`.
- Не правим страницы `/labels/[id]`, `/items/index` (поиск). Они тоже могут навигировать в айтем, но это вне скоупа спеки.
