<script setup lang="ts">
import { X, MapPin, Zap, Pause, Layers, Trash2, Search } from "lucide-vue-next";
import { toast } from "vue-sonner";
import type { ItemSummary, LocationOutCount } from "~~/lib/api/types/data-contracts";
import { useScanner, type ScannerError } from "~/composables/use-scanner";
import { parseHomeboxTarget } from "~~/lib/scanner/parse-homebox-url";

const props = defineProps<{
  open: boolean;
  preloadItems?: ItemSummary[];
  forceQueueMode?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  done: [];
}>();

const session = useMoveSession();
const api = useUserApi();
const scanner = useScanner({
  formats: ["QR_CODE"],
  duplicateDebounceMs: 1500,
});

const videoRef = ref<HTMLVideoElement | null>(null);

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    session.reset();
    if (props.preloadItems?.length) {
      session.preloadQueue(props.preloadItems, props.forceQueueMode ?? true);
    }
    await nextTick();
    if (videoRef.value) await scanner.start(videoRef.value);
  } else {
    scanner.stop();
  }
});

onBeforeUnmount(() => scanner.stop());

const showCloseConfirm = ref(false);

function tryClose() {
  if (session.queue.value.length > 0 && session.mode.value === "queue") {
    showCloseConfirm.value = true;
  } else {
    emit("update:open", false);
    emit("done");
  }
}

function forceClose() {
  showCloseConfirm.value = false;
  emit("update:open", false);
  emit("done");
}

const counterLabel = computed(() => {
  if (session.mode.value === "queue") return `${session.queue.value.length} в очереди`;
  return `${session.recent.value.length} перенесено`;
});

const visibleList = computed(() =>
  session.mode.value === "queue" ? session.queue.value : session.recent.value,
);

const errorMessage = computed<string | null>(() => {
  const err: ScannerError | null = scanner.error.value;
  if (!err) return null;
  switch (err.kind) {
    case "permission_denied": return "Дайте доступ к камере";
    case "no_devices": return "Камера не найдена";
    case "unsupported": return "Сканер не поддерживается в этом браузере (нужен HTTPS и современный браузер)";
    case "init_failed": return `Не удалось запустить камеру: ${err.cause}`;
  }
});

async function retryScanner() {
  if (videoRef.value) await scanner.start(videoRef.value);
}

const lastBadScanAt = ref(0);

scanner.onResult(async (r) => {
  const target = parseHomeboxTarget(r.text);
  if (!target) {
    const now = Date.now();
    if (now - lastBadScanAt.value < 2000) return;
    lastBadScanAt.value = now;
    toast.error("Не наш QR", { duration: 1500 });
    return;
  }
  if (target.kind === "location") {
    if (session.destination.value?.id === target.id) return;
    const resp = await api.locations.get(target.id);
    if (!resp.data) {
      toast.error("Локация не найдена");
      return;
    }
    session.setDestinationFromLocation(resp.data);
    toast.success(`📍 ${resp.data.name}`, { duration: 1500 });
    return;
  }
  const result = await session.scanItemId(target.id);
  switch (result.kind) {
    case "moved":
      toast.success(`✓ ${result.item.name} → ${session.destination.value!.name}`, {
        duration: 5000,
        action: { label: "Отменить", onClick: handleUndo },
      });
      break;
    case "queued":
      toast.success(`+ ${result.item.name}`, { duration: 1500 });
      break;
    case "already-here":
      toast.info(`${result.item.name} уже в ${session.destination.value!.name}`, { duration: 2000 });
      break;
    case "no-destination":
      toast.warning("Сначала выберите локацию", { duration: 2000 });
      break;
    case "not-found":
      toast.error("Вещь не найдена", { duration: 2000 });
      break;
    case "network-error":
      toast.error("Нет сети", {
        duration: 5000,
        action: { label: "Повторить", onClick: () => result.retry() },
      });
      break;
  }
});

async function handleUndo() {
  const ok = await session.undoLast();
  if (ok) toast.success("Отменено");
  else toast.error("Не удалось отменить");
}

async function handleApplyQueue() {
  const result = await session.applyQueue();
  if (result.failed.length === 0) {
    toast.success(`Перенесено ${result.ok}`);
  } else {
    toast.error(`Перенесено ${result.ok}, ошибок ${result.failed.length}`);
  }
}

const showPicker = ref(false);
const allLocations = ref<LocationOutCount[]>([]);
const pickerSearch = ref("");

watch(showPicker, async (open) => {
  if (open && allLocations.value.length === 0) {
    const resp = await api.locations.getAll();
    if (resp.data) allLocations.value = resp.data;
  }
});

const filteredLocations = computed(() => {
  if (!pickerSearch.value) return allLocations.value;
  const q = pickerSearch.value.toLowerCase();
  return allLocations.value.filter(l => l.name.toLowerCase().includes(q));
});

function pickLocation(loc: LocationOutCount) {
  session.setDestinationFromLocation(loc);
  showPicker.value = false;
  pickerSearch.value = "";
}
</script>

<template>
  <Drawer :open="open" @update:open="(v) => v ? emit('update:open', true) : tryClose()">
    <DrawerContent class="h-[100dvh] max-h-[100dvh] flex flex-col">
      <div class="flex items-center justify-between p-3 border-b border-border">
        <DrawerTitle class="text-base font-medium">Сканер</DrawerTitle>
        <button
          class="p-2 rounded-md hover:bg-accent transition-colors"
          aria-label="Закрыть"
          @click="tryClose"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="relative flex-1 bg-black overflow-hidden">
        <video
          ref="videoRef"
          class="w-full h-full object-cover"
          autoplay
          playsinline
          muted
        />
        <div
          v-if="errorMessage"
          class="absolute inset-0 flex flex-col items-center justify-center bg-card text-center p-6 gap-3"
        >
          <p class="text-sm text-muted-foreground">{{ errorMessage }}</p>
          <Button
            v-if="scanner.error.value?.kind !== 'unsupported'"
            size="sm"
            variant="outline"
            @click="retryScanner"
          >
            Повторить
          </Button>
        </div>
      </div>

      <div class="border-t border-border bg-card">
        <div class="px-3 py-2 flex items-center gap-2">
          <MapPin class="w-4 h-4 shrink-0 text-muted-foreground" />
          <template v-if="session.destination.value">
            <button
              class="flex-1 text-left text-sm font-medium truncate hover:text-primary transition-colors"
              @click="showPicker = true"
            >
              {{ session.destination.value.name }}
            </button>
            <button
              class="p-1 rounded text-muted-foreground hover:text-foreground"
              aria-label="Очистить"
              @click="session.clearDestination()"
            >
              <X class="w-4 h-4" />
            </button>
          </template>
          <button
            v-else
            class="flex-1 text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
            @click="/* picker — Task 5 */"
          >
            Выбрать локацию
          </button>
        </div>

        <div class="px-3 py-2 flex items-center justify-between border-t border-border">
          <span class="text-xs text-muted-foreground">{{ counterLabel }}</span>
          <button
            class="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent transition-colors"
            @click="session.mode.value = session.mode.value === 'immediate' ? 'queue' : 'immediate'"
          >
            <Zap v-if="session.mode.value === 'immediate'" class="w-3.5 h-3.5" />
            <Pause v-else class="w-3.5 h-3.5" />
            <span>{{ session.mode.value === 'immediate' ? 'Сразу' : 'Очередь' }}</span>
          </button>
        </div>

        <div
          v-if="visibleList.length > 0"
          class="px-3 py-2 max-h-32 overflow-y-auto border-t border-border space-y-1"
        >
          <div
            v-for="item in visibleList.slice(0, 5)"
            :key="item.id"
            class="flex items-center justify-between gap-2 text-sm"
          >
            <span class="truncate">{{ item.name }}</span>
            <button
              v-if="session.mode.value === 'queue'"
              class="p-1 text-muted-foreground hover:text-destructive"
              aria-label="Убрать из очереди"
              @click="session.removeFromQueue(item.id)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
          <div v-if="visibleList.length > 5" class="text-xs text-muted-foreground">
            и ещё {{ visibleList.length - 5 }}…
          </div>
        </div>

        <div v-if="session.mode.value === 'queue' && session.queue.value.length > 0" class="p-3 border-t border-border">
          <Button
            class="w-full"
            :disabled="!session.destination.value || session.applying.value"
            @click="handleApplyQueue"
          >
            <Layers class="w-4 h-4 mr-2" />
            <template v-if="session.applying.value">
              {{ session.applyProgress.value }} / {{ session.queue.value.length }}…
            </template>
            <template v-else-if="session.destination.value">
              Перенести {{ session.queue.value.length }} → {{ session.destination.value.name }}
            </template>
            <template v-else>
              Сначала выберите локацию
            </template>
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>

  <AlertDialog v-model:open="showCloseConfirm">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Отбросить очередь?</AlertDialogTitle>
        <AlertDialogDescription>
          В очереди {{ session.queue.value.length }} вещей. Они не будут перенесены.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Не закрывать</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="forceClose">
          Отбросить
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <Drawer v-model:open="showPicker">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Выбрать локацию</DrawerTitle>
      </DrawerHeader>
      <div class="px-4 pb-6 space-y-3">
        <div class="relative">
          <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            v-model="pickerSearch"
            type="text"
            class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Поиск локации..."
          />
        </div>
        <div class="max-h-64 overflow-y-auto border border-border rounded-lg bg-card">
          <button
            v-for="loc in filteredLocations"
            :key="loc.id"
            class="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
            @click="pickLocation(loc)"
          >
            {{ loc.name }}
            <span class="text-xs text-muted-foreground ml-1">({{ loc.itemCount }})</span>
          </button>
          <div v-if="filteredLocations.length === 0" class="px-3 py-2 text-sm text-muted-foreground">
            Ничего не найдено
          </div>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
