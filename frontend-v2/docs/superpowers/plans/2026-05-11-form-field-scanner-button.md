# Form-field scanner button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-field QR scanner button to picker fields in frontend-v2 forms so the user can pick an existing location or item by scanning its Homebox QR label instead of typing.

**Architecture:** Extract a reusable `EntityScannerSheet.vue` (camera UI) from the current global `ScannerDialog.vue`. Build a thin `ScannerPickerButton.vue` over it whose policy (match accepts → emit picked; mismatch → toast + stay open) lives in a pure helper `decideScanPickAction()`. Wire the button next to picker triggers in five forms.

**Tech Stack:** Vue 3 / Nuxt 3, TypeScript, vitest (node env), vue-sonner toasts, `lucide-vue-next` icons, `@zxing/library` (via existing `useScanner` composable), shadcn-ui (`Button`/`Drawer`/`Dialog`).

**Spec:** `docs/superpowers/specs/2026-05-11-form-field-scanner-button-design.md`

**Working directory:** `homebox/frontend-v2/`. All paths in this plan are relative to that directory unless noted.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `lib/scanner/decide-scan-pick-action.ts` | Create | Pure decision function: given scan text + accepts → `pick` / `mismatch` / `not_homebox`. Testable in node env. |
| `lib/scanner/decide-scan-pick-action.test.ts` | Create | Vitest tests for the pure helper. |
| `components/app/EntityScannerSheet.vue` | Create | Reusable camera surface (video + overlay + torch + device picker + errors). Emits raw `scan` events. |
| `components/app/ScannerDialog.vue` | Refactor | Thin wrapper around `EntityScannerSheet`. Keeps current navigate-on-scan behaviour. Stays bound to `DialogID.Scanner`. |
| `components/app/ScannerPickerButton.vue` | Create | Icon button that opens an `EntityScannerSheet` and emits `picked` on a matching scan; toasts on mismatch/non-Homebox. |
| `components/locations/LocationCreateSheet.vue` | Modify | Scanner button beside parent-location trigger. |
| `components/items/QuickAddSheet.vue` | Modify | Scanner button beside location input + beside parent-item input. |
| `components/items/BatchLocationSheet.vue` | Modify | Scanner button beside location search input. |
| `components/items/FilterBar.vue` | Modify | Scanner button beside the location filter chip. |
| `pages/items/[id].vue` | Modify | Scanner button beside the location `<select>` in the edit form. |

---

## Conventions reminders

- **Package manager:** `pnpm` (v10). Never `npm`. Lockfile is `pnpm-lock.yaml`.
- **Test runner:** `pnpm test` (single run) or `pnpm test:watch`. Vitest config uses `environment: "node"` — no DOM. So component tests must be avoided unless we add jsdom; we keep logic in pure helpers and skip component-level tests.
- **Type/build check:** there is no dedicated `typecheck` script. Use `pnpm build` (runs Nuxt build, which type-checks) before final commit. For quick checks during work just run the tests.
- **Nuxt auto-imports:** Components under `components/` and composables under `composables/` are auto-imported in `.vue` templates. In `<script setup>` you still import third-party libs explicitly (`lucide-vue-next`, `vue-sonner`, etc.).
- **Toasts:** `import { toast } from "vue-sonner"` and call `toast.error(...)` / `toast.info(...)`. Already used everywhere.
- **Icon for scanner button:** `ScanLine` from `lucide-vue-next` (same as the global scanner trigger in `layouts/default.vue`).
- **Commit style:** match existing log — `feat(frontend-v2): ...`, `refactor(frontend-v2): ...`. Include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` line.
- **Localization:** Russian UI strings (existing convention). Toast/labels in Russian.

---

## Task 1: Pure decision helper `decideScanPickAction`

**Files:**
- Create: `lib/scanner/decide-scan-pick-action.ts`
- Test: `lib/scanner/decide-scan-pick-action.test.ts`

This isolates the policy logic from the UI so it can be tested in the existing node-only vitest setup.

- [ ] **Step 1: Write the failing test**

Create `lib/scanner/decide-scan-pick-action.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decideScanPickAction } from "./decide-scan-pick-action";

const LOC_UUID = "11111111-1111-1111-1111-111111111111";
const ITEM_UUID = "22222222-2222-2222-2222-222222222222";

describe("decideScanPickAction", () => {
  it("picks a location when accepts=['location']", () => {
    expect(
      decideScanPickAction(`https://h.local/locations/${LOC_UUID}`, ["location"]),
    ).toEqual({ type: "pick", target: { kind: "location", id: LOC_UUID } });
  });

  it("picks an item when accepts=['item']", () => {
    expect(
      decideScanPickAction(`https://h.local/items/${ITEM_UUID}`, ["item"]),
    ).toEqual({ type: "pick", target: { kind: "item", id: ITEM_UUID } });
  });

  it("reports mismatch when location-only field gets an item QR", () => {
    expect(
      decideScanPickAction(`https://h.local/items/${ITEM_UUID}`, ["location"]),
    ).toEqual({ type: "mismatch", expected: "location" });
  });

  it("reports mismatch when item-only field gets a location QR", () => {
    expect(
      decideScanPickAction(`https://h.local/locations/${LOC_UUID}`, ["item"]),
    ).toEqual({ type: "mismatch", expected: "item" });
  });

  it("picks either kind when accepts=['location','item']", () => {
    expect(
      decideScanPickAction(`https://h.local/items/${ITEM_UUID}`, ["location", "item"]),
    ).toEqual({ type: "pick", target: { kind: "item", id: ITEM_UUID } });
    expect(
      decideScanPickAction(`https://h.local/locations/${LOC_UUID}`, ["item", "location"]),
    ).toEqual({ type: "pick", target: { kind: "location", id: LOC_UUID } });
  });

  it("reports not_homebox for non-URL text", () => {
    expect(decideScanPickAction("just a sticky note", ["location"]))
      .toEqual({ type: "not_homebox" });
  });

  it("reports not_homebox for external URL", () => {
    expect(decideScanPickAction("https://example.com/", ["location"]))
      .toEqual({ type: "not_homebox" });
  });

  it("reports not_homebox for a label URL even when accepts is broad", () => {
    expect(
      decideScanPickAction(`https://h.local/labels/${LOC_UUID}`, ["location", "item"]),
    ).toEqual({ type: "not_homebox" });
  });

  it("accepts legacy singular paths", () => {
    expect(
      decideScanPickAction(`https://h.local/location/${LOC_UUID}`, ["location"]),
    ).toEqual({ type: "pick", target: { kind: "location", id: LOC_UUID } });
    expect(
      decideScanPickAction(`https://h.local/item/${ITEM_UUID}`, ["item"]),
    ).toEqual({ type: "pick", target: { kind: "item", id: ITEM_UUID } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- decide-scan-pick-action`
Expected: FAIL with module-not-found for `./decide-scan-pick-action`.

- [ ] **Step 3: Implement the helper**

Create `lib/scanner/decide-scan-pick-action.ts`:

```ts
import { parseHomeboxTarget, type HomeboxTarget } from "./parse-homebox-url";

export type ScanPickKind = HomeboxTarget["kind"]; // 'item' | 'location'

export type ScanPickAction =
  | { type: "pick"; target: HomeboxTarget }
  | { type: "mismatch"; expected: ScanPickKind | "either" }
  | { type: "not_homebox" };

/**
 * Decides what a scanner picker should do with a raw QR text given the
 * kinds the field accepts. Keeping this pure makes the policy testable
 * without a DOM/camera.
 */
export function decideScanPickAction(
  text: string,
  accepts: readonly ScanPickKind[],
): ScanPickAction {
  const target = parseHomeboxTarget(text);
  if (!target) return { type: "not_homebox" };
  if (!accepts.includes(target.kind)) {
    const expected: ScanPickKind | "either" =
      accepts.length === 1 ? accepts[0]! : "either";
    return { type: "mismatch", expected };
  }
  return { type: "pick", target };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- decide-scan-pick-action`
Expected: all tests PASS (9 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/scanner/decide-scan-pick-action.ts lib/scanner/decide-scan-pick-action.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend-v2): add decideScanPickAction helper

Pure helper that turns a scanned QR text + accepted kinds into a
pick/mismatch/not_homebox decision. Isolates the policy from UI so it
can be tested in the existing node-only vitest setup.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extract `EntityScannerSheet.vue`

**Files:**
- Create: `components/app/EntityScannerSheet.vue`

Lift the camera UI out of `ScannerDialog.vue` verbatim, drop the result overlay, replace the navigate logic with a `scan` emit. The dialog will be re-wired in Task 3.

- [ ] **Step 1: Create the component file**

Create `components/app/EntityScannerSheet.vue` with this exact content:

```vue
<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from "vue";
import { DialogRoot } from "reka-ui";
import { Flashlight, FlashlightOff } from "lucide-vue-next";
import { useScanner, type ScanResult } from "~/composables/use-scanner";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";

const props = defineProps<{
  open: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  scan: [result: ScanResult];
}>();

const videoEl = ref<HTMLVideoElement | null>(null);

// Suppress the same code from emitting more than once per ~0.8s while the
// user is still holding the camera over the label. The picker resets the
// scanner after each emit so distinct scans still fire.
const scanner = useScanner({
  formats: ["QR_CODE"],
  duplicateDebounceMs: 800,
});

watch(
  () => props.open,
  async (val) => {
    if (val) {
      await nextTick();
      if (videoEl.value) await scanner.start(videoEl.value);
    } else {
      scanner.stop();
    }
  },
);

// Each successful decode is emitted raw — the caller decides what to do.
// We immediately reset() so the next frame can produce another result.
watch(
  () => scanner.result.value,
  (r) => {
    if (!r) return;
    emit("scan", r);
    scanner.reset();
  },
);

onUnmounted(() => {
  scanner.stop();
});

function close(): void {
  emit("update:open", false);
}

async function retry(): Promise<void> {
  scanner.stop();
  await nextTick();
  if (videoEl.value) await scanner.start(videoEl.value);
}
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => !v && close()">
    <DialogContent
      class="w-screen h-screen max-w-none p-0 md:max-w-2xl md:h-[80vh] md:rounded-lg overflow-hidden bg-black"
    >
      <DialogTitle class="sr-only">{{ title ?? "Сканировать QR" }}</DialogTitle>

      <!-- Error state -->
      <div
        v-if="scanner.error.value"
        class="flex h-full flex-col items-center justify-center gap-4 p-6 bg-card text-foreground"
      >
        <p class="text-center text-sm">
          <template v-if="scanner.error.value.kind === 'unsupported'">Требуется HTTPS и современный браузер.</template>
          <template v-else-if="scanner.error.value.kind === 'permission_denied'">Разрешите доступ к камере в настройках браузера.</template>
          <template v-else-if="scanner.error.value.kind === 'no_devices'">Камера не найдена.</template>
          <template v-else>Не удалось запустить камеру: {{ scanner.error.value.cause }}</template>
        </p>
        <div class="flex gap-2">
          <button
            v-if="scanner.error.value.kind !== 'unsupported'"
            class="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            @click="retry"
          >
            Попробовать снова
          </button>
          <button class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm" @click="close">
            Закрыть
          </button>
        </div>
      </div>

      <div v-else class="relative w-full h-full">
        <video ref="videoEl" class="w-full h-full object-cover" autoplay playsinline muted />

        <!-- Scan region overlay -->
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 max-w-[70vw] max-h-[70vw]">
            <div class="absolute inset-0 bg-transparent rounded-md" style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.4);" />
            <div class="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl" />
            <div class="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr" />
            <div class="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl" />
            <div class="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br" />
          </div>
        </div>

        <!-- Camera selector — only when there is real choice -->
        <div
          v-if="scanner.devices.value.length > 1"
          class="absolute left-1/2 -translate-x-1/2 bottom-4 w-[90%] max-w-sm"
        >
          <select
            class="w-full px-3 py-2 bg-card/90 text-foreground rounded-md text-sm border"
            :value="scanner.selectedDeviceId.value ?? ''"
            @change="(e) => scanner.selectDevice((e.target as HTMLSelectElement).value)"
          >
            <option v-for="d in scanner.devices.value" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || `Камера ${d.deviceId.slice(0, 6)}` }}
            </option>
          </select>
        </div>

        <!-- Top bar: close + torch -->
        <div class="absolute top-0 inset-x-0 p-4 flex justify-between bg-gradient-to-b from-black/60 to-transparent">
          <button class="text-white p-2" aria-label="Закрыть" @click="close">✕</button>
          <button
            v-if="scanner.hasTorch.value"
            class="text-white p-2"
            :class="{ 'text-yellow-400': scanner.torchOn.value }"
            :aria-label="scanner.torchOn.value ? 'Выключить фонарик' : 'Включить фонарик'"
            @click="scanner.toggleTorch()"
          >
            <component :is="scanner.torchOn.value ? Flashlight : FlashlightOff" class="w-5 h-5" />
          </button>
        </div>
      </div>
    </DialogContent>
  </DialogRoot>
</template>
```

Notes on differences vs. current `ScannerDialog.vue`:
- Uses `DialogRoot` from `reka-ui` directly with a local `open` prop. The project's `<Dialog>` wrapper is bound to the global `DialogID` provider and is not suitable for a per-instance picker.
- `DialogContent` and `DialogTitle` come from the project's shadcn wrappers (`@/components/ui/dialog`).
- `DialogTitle` is included (`sr-only`) — reka-ui complains without an accessible title.
- No result overlay, no `parseHomeboxUrl` import — emit-only.
- `duplicateDebounceMs: 800` so picker doesn't toast-spam while the camera holds one label.
- `result.value` is watched; after emit we `reset()` so the next frame can fire again. The original navigate path doesn't need this because it closes the dialog after one scan.

- [ ] **Step 2: Run the test suite to ensure nothing else broke**

Run: `pnpm test`
Expected: all existing tests still pass (no new tests added in this task; the helper test from Task 1 also passes).

- [ ] **Step 3: Commit**

```bash
git add components/app/EntityScannerSheet.vue
git commit -m "$(cat <<'EOF'
feat(frontend-v2): add EntityScannerSheet camera surface

Reusable camera UI (video + overlay + torch + device picker + error
states) that emits raw scan results. Will back both the global scanner
dialog and per-field scanner picker buttons.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Refactor `ScannerDialog.vue` over `EntityScannerSheet`

**Files:**
- Modify: `components/app/ScannerDialog.vue` (full rewrite, ~60 lines)

- [ ] **Step 1: Replace file content**

Overwrite `components/app/ScannerDialog.vue` with:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { toast } from "vue-sonner";
import { useDialog, DialogID } from "@/components/ui/dialog-provider/utils";
import { parseHomeboxUrl } from "~/lib/scanner/parse-homebox-url";
import type { ScanResult } from "~/composables/use-scanner";

const { activeDialog, closeDialog } = useDialog();
const isOpen = computed(() => activeDialog.value === DialogID.Scanner);

function close(): void {
  closeDialog(DialogID.Scanner);
}

// Legacy and v2 frontends use different path conventions (/item vs /items).
// parseHomeboxUrl normalises both to v2 and ignores origin so old printed
// labels (with the legacy hostname) still navigate locally.
function onScan(r: ScanResult): void {
  const localPath = parseHomeboxUrl(r.text);
  if (localPath) {
    close();
    navigateTo(localPath);
    return;
  }

  let url: URL | null = null;
  try {
    url = new URL(r.text);
  } catch {
    url = null;
  }
  if (url) {
    close();
    toast.info(`Внешняя ссылка: ${r.text}`, {
      action: { label: "Открыть", onClick: () => window.open(r.text, "_blank") },
    });
    return;
  }
  close();
  toast.info(`Не распознано: ${r.text}`);
}
</script>

<template>
  <EntityScannerSheet
    :open="isOpen"
    title="Сканировать QR"
    @update:open="(v) => !v && close()"
    @scan="onScan"
  />
</template>
```

Notes:
- The global scanner closes after every decode (matching today's behaviour for matching/external/unknown alike — today it auto-navigates on Homebox URL and shows a toast on other inputs but doesn't keep scanning).
- `EntityScannerSheet` is auto-imported (Nuxt component scan).
- No `result.value` watching here — `EntityScannerSheet` does that and emits.

- [ ] **Step 2: Run the test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 3: Run a production build to type-check**

Run: `pnpm build`
Expected: build completes without TS errors. (Build outputs to `.output/`; takes ~30–60s.)

- [ ] **Step 4: Manual smoke test (recommended before commit)**

```bash
pnpm dev
```

Open http://localhost:3000 in Chrome on the same machine (or http://<host>:3000 with HTTPS reverse-proxy). Open Quick Menu → tap «Сканировать», scan any Homebox QR — should navigate to the entity. Scan a random QR — should toast «Не распознано». Close dev server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add components/app/ScannerDialog.vue
git commit -m "$(cat <<'EOF'
refactor(frontend-v2): ScannerDialog uses EntityScannerSheet

ScannerDialog becomes a thin policy wrapper (navigate-on-match + toast)
over the new shared camera surface. Behaviour is preserved for the global
top-bar scanner trigger.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `ScannerPickerButton.vue`

**Files:**
- Create: `components/app/ScannerPickerButton.vue`

- [ ] **Step 1: Create the component**

Create `components/app/ScannerPickerButton.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import { ScanLine } from "lucide-vue-next";
import { toast } from "vue-sonner";
import {
  decideScanPickAction,
  type ScanPickKind,
} from "~/lib/scanner/decide-scan-pick-action";
import type { HomeboxTarget } from "~/lib/scanner/parse-homebox-url";
import type { ScanResult } from "~/composables/use-scanner";

const props = defineProps<{
  accepts: readonly ScanPickKind[];
  ariaLabel?: string;
  /** Tailwind classes appended to the button — lets callers tweak size/spacing. */
  buttonClass?: string;
}>();

const emit = defineEmits<{
  picked: [target: HomeboxTarget];
}>();

const open = ref(false);

// Hide on platforms without camera or in insecure contexts (http on non-localhost).
// Same pattern as components/niimbot/NiimbotPrint.vue uses for Web Bluetooth.
const isSupported = computed(() => {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
});

const derivedAriaLabel = computed(() => {
  if (props.ariaLabel) return props.ariaLabel;
  if (props.accepts.length === 1 && props.accepts[0] === "location") return "Сканировать локацию";
  if (props.accepts.length === 1 && props.accepts[0] === "item") return "Сканировать вещь";
  return "Сканировать";
});

function onScan(r: ScanResult): void {
  const action = decideScanPickAction(r.text, props.accepts);
  switch (action.type) {
    case "pick":
      open.value = false;
      emit("picked", action.target);
      return;
    case "mismatch":
      if (action.expected === "location") toast.error("Ожидается локация");
      else if (action.expected === "item") toast.error("Ожидается вещь");
      else toast.error("Не подходит для этого поля");
      // Stay open — user can rescan.
      return;
    case "not_homebox":
      toast.error("QR не из Homebox");
      return;
  }
}
</script>

<template>
  <button
    v-if="isSupported"
    type="button"
    :aria-label="derivedAriaLabel"
    :class="[
      'inline-flex items-center justify-center shrink-0 rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
      buttonClass ?? 'w-9 h-9',
    ]"
    @click="open = true"
  >
    <ScanLine class="w-4 h-4" />
  </button>
  <EntityScannerSheet
    :open="open"
    :title="derivedAriaLabel"
    @update:open="open = $event"
    @scan="onScan"
  />
</template>
```

- [ ] **Step 2: Run the test suite**

Run: `pnpm test`
Expected: PASS (no new tests in this task — UI verified via integration in later tasks; the policy lives in Task 1's tested helper).

- [ ] **Step 3: Type-check via build**

Run: `pnpm build`
Expected: build succeeds. If it fails, fix the reported TS error before continuing.

- [ ] **Step 4: Commit**

```bash
git add components/app/ScannerPickerButton.vue
git commit -m "$(cat <<'EOF'
feat(frontend-v2): add ScannerPickerButton

Reusable icon button that opens an EntityScannerSheet, validates the
scanned QR against the field's accepted kinds via decideScanPickAction,
and emits the picked entity. Mismatches show a toast and keep the sheet
open. Hidden on devices without a camera or insecure contexts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Integrate in `LocationCreateSheet.vue`

**Files:**
- Modify: `components/locations/LocationCreateSheet.vue` (lines 170-227 area + add lookup helper)

The parent-location field has a button-trigger at line 173-182. Add the scanner button next to it, in the same row.

- [ ] **Step 1: Read the current parent-location block (context anchor)**

Run: `git diff --no-index -- /dev/null components/locations/LocationCreateSheet.vue` is not needed; just open the file at lines 170-227 to anchor the edit.

- [ ] **Step 2: Apply the edit**

Replace the existing block between the label and the closing `</div>` of the parent picker. The simplest edit is to wrap the trigger button + scanner into a flex row and add a `@picked` handler.

Find this exact slice (around lines 172-182):

```vue
        <!-- Parent location — searchable picker -->
        <div>
          <label class="text-sm font-medium">Родительская локация</label>
          <button
            type="button"
            class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring"
            @click="parentPickerOpen = !parentPickerOpen"
          >
            <span class="truncate text-left" :class="!selectedParentId && 'text-muted-foreground'">
              {{ selectedParentLabel }}
            </span>
            <ChevronsUpDown class="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
          </button>
```

Replace it with:

```vue
        <!-- Parent location — searchable picker + scan -->
        <div>
          <label class="text-sm font-medium">Родительская локация</label>
          <div class="mt-1 flex gap-2">
            <button
              type="button"
              class="flex-1 px-3 py-2 bg-card border border-input rounded-lg text-sm flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring"
              @click="parentPickerOpen = !parentPickerOpen"
            >
              <span class="truncate text-left" :class="!selectedParentId && 'text-muted-foreground'">
                {{ selectedParentLabel }}
              </span>
              <ChevronsUpDown class="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
            </button>
            <ScannerPickerButton :accepts="['location']" @picked="onScannedParent" />
          </div>
```

(Only the wrapping `<div class="mt-1 flex gap-2">`, the `flex-1` class on the existing button, removal of its `mt-1`, and the new `<ScannerPickerButton>` are added.)

- [ ] **Step 3: Add the `onScannedParent` handler in `<script setup>`**

Find the existing `selectParent` function in the script block:

```ts
  parentPickerOpen.value = false;
```

(There's a `selectParent` function around line 50-55 that sets `selectedParentId.value = id; parentPickerOpen.value = false;`.)

Add this immediately after `selectParent`:

```ts
const tree = useLocationTree();

function onScannedParent(target: { kind: "item" | "location"; id: string }) {
  if (tree.getNode(target.id) === null) {
    toast.error("Локация не найдена в списке");
    return;
  }
  selectParent(target.id);
}
```

Also add the `toast` import at the top of `<script setup>` if not already imported (it currently is — confirmed in the file). If not, add `import { toast } from "vue-sonner";`.

`useLocationTree` is auto-imported in `.vue` (Nuxt composable). No import line needed.

- [ ] **Step 4: Type-check and run tests**

Run: `pnpm test && pnpm build`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add components/locations/LocationCreateSheet.vue
git commit -m "$(cat <<'EOF'
feat(frontend-v2): scanner button on parent-location picker in LocationCreateSheet

Lets the user pick the parent location by scanning its printed QR label
instead of opening the searchable picker.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Integrate in `QuickAddSheet.vue` — location field

**Files:**
- Modify: `components/items/QuickAddSheet.vue` (around lines 316-366 + add handler in script)

The location field is at lines 317-327 (input wrapped in `<div class="mt-1 relative">`) and the selected chip is at 354-365.

- [ ] **Step 1: Add scanner button beside the search input**

Find this block (around lines 317-327):

```vue
        <!-- Location with search -->
        <div>
          <label class="text-sm font-medium">Место</label>
          <div class="mt-1 relative">
            <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              v-model="locationSearch"
              type="text"
              class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              :placeholder="selectedLocationName || 'Поиск локации...'"
            />
          </div>
```

Replace with:

```vue
        <!-- Location with search -->
        <div>
          <label class="text-sm font-medium">Место</label>
          <div class="mt-1 flex gap-2">
            <div class="relative flex-1">
              <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                v-model="locationSearch"
                type="text"
                class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                :placeholder="selectedLocationName || 'Поиск локации...'"
              />
            </div>
            <ScannerPickerButton :accepts="['location']" @picked="onScannedLocation" />
          </div>
```

- [ ] **Step 2: Add the handler in `<script setup>`**

In `QuickAddSheet.vue`, find the existing `selectedLocationName` computed (around line 65-69) and add this immediately below it:

```ts
function onScannedLocation(target: { kind: "item" | "location"; id: string }) {
  if (!locations.value.some(l => l.id === target.id)) {
    toast.error("Локация не найдена в списке");
    return;
  }
  locationId.value = target.id;
  locationSearch.value = "";
}
```

`toast` is already imported in this file (line 6).

- [ ] **Step 3: Run tests + build**

Run: `pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/items/QuickAddSheet.vue
git commit -m "$(cat <<'EOF'
feat(frontend-v2): scanner button on location field in QuickAddSheet

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Integrate in `QuickAddSheet.vue` — parent-item field

**Files:**
- Modify: `components/items/QuickAddSheet.vue` (around lines 521-578 + add handler in script)

Parent-item search lives behind the «Больше подробностей» toggle. The visible search input is at lines 524-532, the selected chip at 561-577.

- [ ] **Step 1: Add scanner button beside the search input**

Find:

```vue
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
```

Replace with:

```vue
          <!-- Parent item (optional) -->
          <div>
            <label class="text-sm font-medium">Родительская вещь</label>
            <div v-if="!selectedParent" class="mt-1 flex gap-2">
              <div class="relative flex-1">
                <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  v-model="parentSearch"
                  type="text"
                  class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Поиск вещи..."
                />
              </div>
              <ScannerPickerButton :accepts="['item']" @picked="onScannedParent" />
            </div>
```

- [ ] **Step 2: Add the handler in `<script setup>`**

The parent-item picker doesn't keep a local cache of all items (it does on-demand search). So we resolve by id via the API. Find the existing `selectParent` function (around lines 104-109) and add right above it (or right below `clearParent`):

```ts
async function onScannedParent(target: { kind: "item" | "location"; id: string }) {
  const resp = await api.items.get(target.id);
  if (resp.error || !resp.data) {
    toast.error("Вещь не найдена");
    return;
  }
  selectParent(resp.data);
}
```

`selectParent` accepts `ItemSummary`, and `api.items.get()` returns `ItemOut` which is a superset (compatible with the fields `selectParent` uses: `id`, `name`, `location`). If the build complains about the type, cast: `selectParent(resp.data as unknown as ItemSummary)` — but try without the cast first.

- [ ] **Step 3: Run tests + build**

Run: `pnpm test && pnpm build`
Expected: PASS. If the type cast is needed, apply it as the smallest possible change and re-run.

- [ ] **Step 4: Commit**

```bash
git add components/items/QuickAddSheet.vue
git commit -m "$(cat <<'EOF'
feat(frontend-v2): scanner button on parent-item field in QuickAddSheet

Verifies the scanned item id via the API before picking, since the
parent-item field has no local cache.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Integrate in `BatchLocationSheet.vue`

**Files:**
- Modify: `components/items/BatchLocationSheet.vue` (around lines 76-84 + add handler in script)

- [ ] **Step 1: Add scanner button beside the search input**

Find this block (around lines 75-84):

```vue
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
```

Replace with:

```vue
        <!-- Location search + scan -->
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              v-model="locationSearch"
              type="text"
              class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              :placeholder="selectedLocationName || 'Поиск локации...'"
            />
          </div>
          <ScannerPickerButton :accepts="['location']" @picked="onScannedLocation" />
        </div>
```

- [ ] **Step 2: Add the handler in `<script setup>`**

In `BatchLocationSheet.vue`, find `selectedLocationName` computed (around lines 31-35) and add immediately below:

```ts
function onScannedLocation(target: { kind: "item" | "location"; id: string }) {
  if (!locations.value.some(l => l.id === target.id)) {
    toast.error("Локация не найдена в списке");
    return;
  }
  locationId.value = target.id;
  locationSearch.value = "";
}
```

`toast` is already imported (line 4).

- [ ] **Step 3: Run tests + build**

Run: `pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/items/BatchLocationSheet.vue
git commit -m "$(cat <<'EOF'
feat(frontend-v2): scanner button on BatchLocationSheet target picker

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Integrate in `FilterBar.vue` — location filter chip

**Files:**
- Modify: `components/items/FilterBar.vue` (script + template)

`FilterBar` emits `toggleLocation` — the page (`pages/items/index.vue`) holds the selected-locations list. So the scanner handler also emits `toggleLocation` to toggle the scanned id.

- [ ] **Step 1: Add the handler in `<script setup>`**

In `FilterBar.vue`, find the existing `locationName` function (lines 40-43) and add this just below it:

```ts
function onScannedLocation(target: { kind: "item" | "location"; id: string }) {
  if (!locations.value.some(l => l.id === target.id)) {
    toast.error("Локация не найдена в списке");
    return;
  }
  emit("toggleLocation", target.id);
}
```

Add the import at the top of `<script setup>` (the file does NOT currently import `toast`):

```ts
import { toast } from "vue-sonner";
```

- [ ] **Step 2: Add the button next to the location filter chip**

Find this block (around lines 56-91, the `<DropdownMenu v-model:open="showLocationPicker">` block ending with `</DropdownMenu>`):

```vue
    <!-- Location filter chip -->
    <DropdownMenu v-model:open="showLocationPicker">
      <DropdownMenuTrigger as-child>
        <button ...> ... </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent ...> ... </DropdownMenuContent>
    </DropdownMenu>
```

Wrap the DropdownMenu and the new button in a flex container. Apply this minimal edit: immediately after the closing `</DropdownMenu>` of the location filter (just before the tag-filter `<DropdownMenu>`), insert:

```vue
    <ScannerPickerButton
      :accepts="['location']"
      button-class="w-8 h-8"
      @picked="onScannedLocation"
    />
```

The wrapping `<div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">` already exists at the root of the template — the button sits as another flex child, which is the desired layout (chip + scanner chip).

- [ ] **Step 3: Run tests + build**

Run: `pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/items/FilterBar.vue
git commit -m "$(cat <<'EOF'
feat(frontend-v2): scanner button beside location filter chip in FilterBar

Scanning toggles the scanned location id in the filter, mirroring the
behaviour of tapping the location checkbox.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Integrate in `pages/items/[id].vue` — location edit

**Files:**
- Modify: `pages/items/[id].vue` (around lines 357-368 + add handler near `loadLocationsForEdit`)

The location field is a plain `<select>` populated from `allLocations` (loaded by `loadLocationsForEdit`). Bind the picker beside it.

- [ ] **Step 1: Add scanner button beside the select**

Find this block (around lines 357-368):

```vue
            <div>
              <label class="text-xs text-muted-foreground">Место</label>
              <select
                :value="editForm.location?.id"
                class="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                @change="editForm.location = { id: ($event.target as HTMLSelectElement).value, name: '', description: '', createdAt: '', updatedAt: '' }"
              >
                <option v-for="loc in allLocations" :key="loc.id" :value="loc.id">
                  {{ tree.getPathString(loc.id) ?? loc.name }}
                </option>
              </select>
            </div>
```

Replace with:

```vue
            <div>
              <label class="text-xs text-muted-foreground">Место</label>
              <div class="flex gap-2">
                <select
                  :value="editForm.location?.id"
                  class="flex-1 px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  @change="editForm.location = { id: ($event.target as HTMLSelectElement).value, name: '', description: '', createdAt: '', updatedAt: '' }"
                >
                  <option v-for="loc in allLocations" :key="loc.id" :value="loc.id">
                    {{ tree.getPathString(loc.id) ?? loc.name }}
                  </option>
                </select>
                <ScannerPickerButton :accepts="['location']" @picked="onScannedLocation" />
              </div>
            </div>
```

- [ ] **Step 2: Add the handler in `<script setup>`**

In `pages/items/[id].vue`, find the `loadLocationsForEdit` function (search for `function loadLocationsForEdit`). Right below it, add:

```ts
function onScannedLocation(target: { kind: "item" | "location"; id: string }) {
  const found = allLocations.value.find(l => l.id === target.id);
  if (!found) {
    toast.error("Локация не найдена в списке");
    return;
  }
  editForm.value.location = {
    id: found.id,
    name: found.name,
    description: "",
    createdAt: "",
    updatedAt: "",
  };
}
```

Verify `toast` is imported. If not (search for `from "vue-sonner"` in the file), add:

```ts
import { toast } from "vue-sonner";
```

- [ ] **Step 3: Run tests + build**

Run: `pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add pages/items/[id].vue
git commit -m "$(cat <<'EOF'
feat(frontend-v2): scanner button on item location edit field

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Manual verification & deploy notes

Camera-dependent flows can't be exercised in vitest. After all code tasks pass tests and build, run a manual sanity pass.

- [ ] **Step 1: Final test + build**

Run: `pnpm test && pnpm build`
Expected: green.

- [ ] **Step 2: Local dev server smoke**

Run: `pnpm dev`
Open http://localhost:3000 in Chrome.

Manual checklist (with a printed Homebox QR of a known location and another of a known item; or use the address bar to copy a URL like `http://localhost:3000/locations/<uuid>` and generate one with any web QR-generator):

  - [ ] **Global scanner unchanged.** Top-bar / quick-menu scanner: scan location QR → navigates to /locations/<id>. Scan item QR → /items/<id>. Scan external URL → toast "Внешняя ссылка". Scan random text → toast "Не распознано".
  - [ ] **LocationCreateSheet.** Open from any location card. Click scanner button beside "Родительская локация". Scan a location QR of a known location → field shows that location's name. Scan an item QR → toast «Ожидается локация», sheet stays open. Scan a random QR → toast «QR не из Homebox».
  - [ ] **QuickAddSheet — location.** Open from FAB on items index. Click scanner beside "Место". Scan known location → field populated. Scan item QR → mismatch toast.
  - [ ] **QuickAddSheet — parent item.** Expand «Больше подробностей». Click scanner beside "Родительская вещь". Scan known item QR → parent chip populated. Scan location QR → toast «Ожидается вещь». Scan an item id that's been deleted on backend (or fake one) → toast «Вещь не найдена».
  - [ ] **BatchLocationSheet.** Select some items on items index, open batch move sheet, scan location → field populated.
  - [ ] **FilterBar.** On items index, click scanner chip beside the location filter chip. Scan known location → results filter to that location (chip count increases). Scan again with the same QR → location removed from filter (toggle).
  - [ ] **Items detail.** Edit "Детали" section, click scanner beside location select → select reflects scanned location. Save.
  - [ ] **No-camera UX.** Open in a desktop browser without a camera (or DevTools → Sensors → simulate no devices, easier: use a build deploy to a desktop where you know there's no webcam). The scanner buttons should not render. The page should still work.

- [ ] **Step 3: Deploy (only when manual checklist is fully green)**

```bash
cd ..  # to homebox/ — Dockerfile is at frontend-v2/Dockerfile
docker buildx build --platform linux/arm64 \
  -t docker.struchkov.dev/homebox-frontend-v2:latest \
  -f frontend-v2/Dockerfile --load frontend-v2/
docker push docker.struchkov.dev/homebox-frontend-v2:latest
ssh pi-four "docker pull docker.struchkov.dev/homebox-frontend-v2:latest && cd /root && docker compose up -d homebox-v2"
ssh pi-four "docker inspect homebox-v2 --format 'health={{.State.Health.Status}} restarts={{.RestartCount}}'"
```

Expected: `health=healthy`, restart count unchanged.

This step requires the user's go-ahead and SSH key in the security-key slot. If you do not have authorization to deploy, stop after the manual checklist and report.

---

## Self-review notes (already applied)

- **Spec coverage:** Every section of the design spec (architecture, contracts, integration points, error handling, testing) is mapped:
  - Architecture / contracts: Tasks 1–4.
  - Integration points (5 forms / 6 fields): Tasks 5–10.
  - Error handling: covered by the helper tests (mismatch/not_homebox) and the handler-level "not found locally" branch in every integration task.
  - Manual verification: Task 11.
- **Placeholders:** None. Every snippet is concrete.
- **Type consistency:** Component name `ScannerPickerButton`, prop `accepts: readonly ScanPickKind[]`, emit `picked` with `HomeboxTarget` are used consistently across tasks. `decideScanPickAction` matches imports in Task 4 and the test file in Task 1.
- **Test coverage:** All policy branches (`pick` ×2, `mismatch` ×2, `pick either`, `not_homebox` ×3, legacy paths) are in Task 1's test list — 9 cases total. Component-level testing is intentionally out of scope (vitest is node-only here); the integration tasks bind to the same well-tested helper.
