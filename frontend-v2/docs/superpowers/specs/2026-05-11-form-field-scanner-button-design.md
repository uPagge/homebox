# Form-field scanner button — design

Date: 2026-05-11
Scope: frontend-v2

## Problem

In forms that pick an existing entity (a location or an item), the user has to type
or scroll to find it. When the target entity already has a printed Homebox QR label
nearby (a box, a shelf, a parent organiser), it is faster to scan than to search.

The app already has full QR-scanning infrastructure in frontend-v2:

- `composables/use-scanner.ts` — camera lifecycle, ZXing decoder, torch, device picker, debounce, race-safe stop/start.
- `lib/scanner/parse-homebox-url.ts` — parses Homebox URLs into `{kind: 'item'|'location', id}`.
- `components/app/ScannerDialog.vue` — the global scanner reached from the top bar; on a Homebox QR it does `navigateTo()`.
- `components/items/MoveScannerSheet.vue` — a specialised move flow.

Today none of this is wired into form picker fields. We add a small per-field
scanner button that uses the same infrastructure.

## Goals

- Add a scanner button next to picker fields that accept an existing location or item.
- Scanning a matching Homebox QR fills the field with the scanned entity.
- Single shared camera-UI component used by both the global scanner and the per-field
  button — no duplicated camera logic.

## Non-goals

- Scanning into free-text fields (e.g. new-item *name*). Out of scope.
- New entity kinds (labels, tags) in the picker flow. Out of scope.
- Offline lookup of scanned ids — the form does the local lookup itself and may
  report `not found` if data is stale.

## Architecture

Three components, one shared composable:

```
useScanner (composable, existing)
        ↑
EntityScannerSheet.vue (NEW, ~150 lines)
  camera + overlay + torch + device picker
  props: { open: boolean; title?: string }
  emits: 'update:open', 'scan' (ScanResult, raw — no interpretation)
  does NOT render the "Open / Scan again" result panel — caller decides
        ↑                                                ↑
ScannerDialog.vue (REFACTORED, ~50 lines)        ScannerPickerButton.vue (NEW, ~60 lines)
  thin wrapper, bound to DialogID.Scanner          thin wrapper
  on scan: navigateTo / external-url toast /       props: { accepts: ('item'|'location')[], ariaLabel? }
    "not recognised" toast (current behaviour)     emits: 'picked' (HomeboxTarget)
                                                   on scan: parseHomeboxTarget → match accepts →
                                                     emit + close;
                                                     kind mismatch → toast + stay open;
                                                     non-Homebox QR → toast + stay open
```

Why this split:

- `EntityScannerSheet` is a reusable camera surface. It does not know about routing
  or about which kinds the caller accepts — it just emits decoded scans.
- The two wrappers are thin and have one job each: the dialog navigates, the button
  picks. Adding more scanner-driven surfaces in the future (e.g. another batch-op)
  reuses `EntityScannerSheet`.
- No global Pinia/store state for scanner configuration. `ScannerPickerButton` owns
  its own `open` ref, so its camera lifecycle is tied to its own mount.

## Component contracts

### EntityScannerSheet (new)

```ts
defineProps<{
  open: boolean
  title?: string  // header label, default "Сканировать QR"
}>()

defineEmits<{
  'update:open': [boolean]
  'scan': [ScanResult]  // every successful decode; caller decides what to do
}>()
```

- On `open=true` → `scanner.start(videoEl)`. On `open=false` → `scanner.stop()`.
  `onUnmounted` also calls `scanner.stop()`.
- Renders the camera UI that lives in `ScannerDialog.vue` today: video element,
  corner-bracket overlay, error states (`unsupported` / `permission_denied` /
  `no_devices` / `init_failed`), camera selector (visible only when there is more
  than one camera), torch toggle.
- Does NOT render the result overlay ("Открыть / Сканировать ещё") — that UI is
  navigate-specific. After each successful decode, the sheet calls `scanner.reset()`
  so the next frame can emit another `scan`.
- Uses `useScanner({ formats: ['QR_CODE'], duplicateDebounceMs: 800 })`. The
  debounce prevents the same QR from emitting three times while the user is still
  holding the camera over it.

### ScannerDialog (refactored)

Remains the consumer of `DialogID.Scanner`. Becomes a thin wrapper:

```vue
<EntityScannerSheet :open="isOpen" @update:open="v => !v && close()" @scan="onScan" />
```

`onScan(result)` keeps the existing semantics:

1. `parseHomeboxUrl(result.text)` → `navigateTo(...)` + close.
2. Else if `new URL(result.text)` is valid → `toast.info('Внешняя ссылка: ...', { action: { label: 'Открыть', ... } })`.
3. Else → `toast.info('Не распознано: ...')`.

### ScannerPickerButton (new)

```ts
defineProps<{
  accepts: ('item' | 'location')[]
  ariaLabel?: string  // default derived from accepts
}>()

defineEmits<{
  'picked': [HomeboxTarget]  // { kind: 'item' | 'location', id: string }
}>()
```

Renders a square icon button (`ScanLine` from `lucide-vue-next`). Renders nothing
when `!navigator.mediaDevices?.getUserMedia` — desktop without camera, http origin,
or unsupported browser. The form does not need to gate the button itself.

On click: opens a local `EntityScannerSheet`.

`onScan(result)`:

1. `target = parseHomeboxTarget(result.text)`. If `null` → `toast.error('QR не из Homebox')`, stay open.
2. If `target.kind` is not in `accepts` → `toast.error('Ожидается локация')` / `'Ожидается вещь'`, stay open.
3. Otherwise → `emit('picked', target)` and close.

`EntityScannerSheet` resets its scanner after each emit, so "stay open" works
without further action from the button.

Default ariaLabel / mismatch text by `accepts`:

| accepts | ariaLabel | mismatch text |
|---|---|---|
| `['location']` | «Сканировать локацию» | «Ожидается локация» |
| `['item']` | «Сканировать вещь» | «Ожидается вещь» |
| `['location','item']` | «Сканировать» | mismatch не возможен |

## Integration points

Same pattern in every form: render `<ScannerPickerButton>` as a *sibling* of the
existing picker trigger (not nested inside — avoids nested-button a11y issues).
On `@picked` call the form's existing selection method.

| Form | Field | accepts | On picked |
|---|---|---|---|
| `components/locations/LocationCreateSheet.vue` | Родительская локация | `['location']` | `selectParent(target.id)` |
| `components/items/QuickAddSheet.vue` | Локация новой вещи | `['location']` | `locationId = target.id; locationSearch = ''` |
| `components/items/QuickAddSheet.vue` | Родитель-вещь | `['item']` | reuse the existing pick handler (`selectedParent = found; parentSearch = ''`) |
| `components/items/BatchLocationSheet.vue` | Целевая локация | `['location']` | `locationId = target.id` |
| `components/items/FilterBar.vue` | Фильтр-чип «Location» | `['location']` | `emit('toggleLocation', target.id)` |
| `pages/items/[id].vue` / `components/items/detail/ItemDetailSection.vue` | Локация вещи при редактировании | `['location']` | the existing location setter (exact path confirmed during implementation) |

Visual placement: typically `<div class="flex gap-2">trigger + ScannerPickerButton</div>`
or as a sibling of the field label aligned right. Final placement is decided per-form
during implementation; the button must remain outside the trigger element.

### Local lookup after picked

Each form does the local lookup itself, because each form already owns its source
of truth (location tree, search results). The button only delivers `{kind, id}`.

If the scanned id is not present locally (stale label, label from another
instance), the form:

- leaves the field unchanged
- shows `toast.error('Локация не найдена')` (or "Вещь не найдена")

This is ~3 lines per form, not a generic abstraction.

## Error handling

| Case | Behaviour |
|---|---|
| `!navigator.mediaDevices` | `ScannerPickerButton` renders nothing. Same pattern as `NiimbotPrint` (`v-if="isSupported"`). |
| Permission denied | Existing `EntityScannerSheet` error screen: «Разрешите доступ к камере» + Retry / Close. |
| `no_devices` (HTTPS yes, no cameras) | «Камера не найдена» + Close. Sheet closes, form unchanged. |
| Non-Homebox QR (random text, external URL) | `toast.error('QR не из Homebox')`, sheet stays open, scanner keeps decoding. |
| Kind mismatch | `toast.error('Ожидается локация')` / «вещь», sheet stays open. |
| Valid target, id not found locally | Sheet closes, `emit('picked')` fires, form's lookup fails → `toast.error('Локация не найдена')` and field unchanged. |
| Same frame decoded repeatedly | `duplicateDebounceMs: 800` in `useScanner` suppresses identical text for 0.8s. |
| User closes sheet without scanning | No emit, form unchanged. `EntityScannerSheet` stops the camera. |
| `ScannerPickerButton` unmounted while sheet open (e.g. drawer dismissed) | `EntityScannerSheet.onUnmounted` calls `scanner.stop()` — camera released. |

All toasts go through the existing `vue-sonner` `toast.error(...)` already used
across the codebase.

`useScanner` already protects against open/close races via its `runId` counter —
no additional concurrency work needed.

## Testing

Following project conventions (vitest, examples: `parse-homebox-url.test.ts`,
`pick-camera.test.ts`):

- `EntityScannerSheet` — no component test. It is a thin shell over `useScanner`
  (already exercised indirectly) and its UI is hard to mock meaningfully without
  a real camera. Verified manually through the consuming forms.
- `ScannerPickerButton.test.ts` (new) — stub `EntityScannerSheet` and drive it via
  emitted `scan` events. Cases:
  1. accepts `['location']`, scan location QR → `emit('picked')` fires with the
     parsed target, sheet closes.
  2. accepts `['location']`, scan item QR → no `picked` emit, error toast, sheet
     stays open.
  3. accepts `['item']`, scan location QR → mirror of (2).
  4. Scan non-Homebox text → no `picked` emit, error toast, sheet stays open.
  5. accepts `['location','item']`, scan any Homebox QR → `picked` emit.
  6. `navigator.mediaDevices` undefined → button renders nothing.
- `ScannerDialog` — no new regression test. UI logic is thin; navigation is mocked
  by the framework; current behaviour preserved by reuse of the same emit path.

Manual verification on a phone after deploy to `homebox-v2`:

- open `QuickAddSheet`, tap scan button near the location picker, scan a known
  location QR → location is selected.
- tap the same button, scan an item QR → mismatch toast, scanner keeps running.
- tap the same button, scan a random QR → "QR не из Homebox" toast.
- open the global scanner from the top bar, scan a Homebox QR → still navigates
  (no regression).

Pre-commit gate: `pnpm typecheck && pnpm test && pnpm build` locally.

## Out of scope / future work

- A common "Entity not found" path that proposes opening the scanned URL anyway
  (mirroring option C from the brainstorming). Today the picker is the user's
  declared intent — if they want navigation, they use the global scanner.
- Bulk scanning into multi-select pickers (e.g. tagging many items in a row).
  `FilterBar` is already multi-select but for v1 each scan toggles one location.
- Persisting "last used camera" preference per-picker. Today `useScanner` stores
  it globally via `localStorage`, which is fine.
