<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from "vue";
import { toast } from "vue-sonner";
import { useDialog, DialogID } from "@/components/ui/dialog-provider/utils";
import { useScanner, type ScanResult } from "~/composables/use-scanner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const emit = defineEmits<{
  "scanned-barcode": [text: string];
}>();

const { activeDialog, closeDialog } = useDialog();
const isOpen = computed(() => activeDialog.value === DialogID.Scanner);

const videoEl = ref<HTMLVideoElement | null>(null);

const scanner = useScanner({
  formats: ["QR_CODE", "EAN_13", "EAN_8", "UPC_A", "UPC_E", "CODE_128"],
  duplicateDebounceMs: 0,
});

watch(isOpen, async (val) => {
  if (val) {
    await nextTick();
    if (videoEl.value) {
      await scanner.start(videoEl.value);
    }
  } else {
    scanner.stop();
  }
});

onUnmounted(() => {
  scanner.stop();
});

function close(): void {
  closeDialog(DialogID.Scanner);
}

function handleResult(r: ScanResult): void {
  close();

  if (r.format === "QR_CODE") {
    let url: URL | null = null;
    try {
      url = new URL(r.text, window.location.origin);
    } catch {
      url = null;
    }
    if (url && url.origin === window.location.origin) {
      navigateTo(url.pathname + url.search);
      return;
    }
    if (url) {
      toast.info(`Внешняя ссылка: ${r.text}`, {
        action: { label: "Открыть", onClick: () => window.open(r.text, "_blank") },
      });
      return;
    }
    toast.info(`Не распознано: ${r.text}`);
    return;
  }

  if (["EAN_13", "EAN_8", "UPC_A", "UPC_E", "CODE_128"].includes(r.format)) {
    emit("scanned-barcode", r.text);
    return;
  }

  toast.info(`Не распознано: ${r.text}`);
}

async function retry(): Promise<void> {
  scanner.stop();
  await nextTick();
  if (videoEl.value) {
    await scanner.start(videoEl.value);
  }
}
</script>

<template>
  <Dialog :dialog-id="DialogID.Scanner">
    <DialogContent class="w-screen h-screen max-w-none p-0 md:max-w-2xl md:h-[80vh] md:rounded-lg overflow-hidden bg-black">
      <!-- Error state -->
      <div v-if="scanner.error.value" class="flex h-full flex-col items-center justify-center gap-4 p-6 bg-card text-foreground">
        <p class="text-center text-sm">
          <template v-if="scanner.error.value.kind === 'unsupported'">Требуется HTTPS и современный браузер.</template>
          <template v-else-if="scanner.error.value.kind === 'permission_denied'">Разрешите доступ к камере в настройках браузера.</template>
          <template v-else-if="scanner.error.value.kind === 'no_devices'">Камера не найдена.</template>
          <template v-else>Не удалось запустить камеру: {{ scanner.error.value.cause }}</template>
        </p>
        <div class="flex gap-2">
          <button v-if="scanner.error.value.kind !== 'unsupported'" class="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm" @click="retry">
            Попробовать снова
          </button>
          <button class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm" @click="close">
            Закрыть
          </button>
        </div>
      </div>

      <!-- Live + result share the same video element so the camera does not blink -->
      <div v-else class="relative w-full h-full">
        <video ref="videoEl" class="w-full h-full object-cover" autoplay playsinline muted />

        <!-- Scan region overlay (corner brackets + dimmed surround) -->
        <div v-if="!scanner.result.value && !scanner.error.value" class="pointer-events-none absolute inset-0">
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 max-w-[70vw] max-h-[70vw]">
            <div class="absolute inset-0 bg-transparent rounded-md" style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.4);" />
            <div class="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl" />
            <div class="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr" />
            <div class="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl" />
            <div class="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br" />
          </div>
        </div>

        <!-- Result overlay -->
        <div v-if="scanner.result.value" class="absolute inset-x-0 bottom-0 p-4 bg-card/95 border-t flex flex-col gap-3">
          <p class="text-xs text-muted-foreground">Результат:</p>
          <p class="font-mono text-sm break-all">{{ scanner.result.value.text }}</p>
          <div class="flex gap-2">
            <button class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm" @click="handleResult(scanner.result.value!)">
              {{ scanner.result.value.format === "QR_CODE" ? "Открыть" : "Создать вещь" }}
            </button>
            <button class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm" @click="scanner.reset()">
              Сканировать ещё
            </button>
          </div>
        </div>

        <!-- Top bar: close (visible during live state only) -->
        <div v-if="!scanner.result.value" class="absolute top-0 inset-x-0 p-4 flex justify-between bg-gradient-to-b from-black/60 to-transparent">
          <button class="text-white p-2" aria-label="Закрыть" @click="close">
            ✕
          </button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
