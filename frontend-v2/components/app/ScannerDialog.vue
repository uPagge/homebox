<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from "vue";
import { toast } from "vue-sonner";
import { Flashlight, FlashlightOff } from "lucide-vue-next";
import { useDialog, DialogID } from "@/components/ui/dialog-provider/utils";
import { useScanner, type ScanResult } from "~/composables/use-scanner";
import { parseHomeboxUrl } from "~/lib/scanner/parse-homebox-url";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const { activeDialog, closeDialog } = useDialog();
const isOpen = computed(() => activeDialog.value === DialogID.Scanner);

const videoEl = ref<HTMLVideoElement | null>(null);

const scanner = useScanner({
  formats: ["QR_CODE"],
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

// Auto-navigate without showing the result panel when the QR is a known
// homebox URL — there's nothing to confirm. Other QR contents still go
// through the result panel so the user can pick an action.
watch(() => scanner.result.value, (r) => {
  if (r && parseHomeboxUrl(r.text)) {
    handleResult(r);
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

  // Legacy and v2 frontends use different path conventions (/item vs /items).
  // parseHomeboxUrl normalises both to v2 and ignores origin so old printed
  // labels (with the legacy hostname) still navigate locally.
  const localPath = parseHomeboxUrl(r.text);
  if (localPath) {
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
    toast.info(`Внешняя ссылка: ${r.text}`, {
      action: { label: "Открыть", onClick: () => window.open(r.text, "_blank") },
    });
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

        <!-- Camera selector — only when there's a real choice -->
        <div v-if="!scanner.result.value && !scanner.error.value && scanner.devices.value.length > 1" class="absolute left-1/2 -translate-x-1/2 bottom-4 w-[90%] max-w-sm">
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

        <!-- Result overlay -->
        <div v-if="scanner.result.value" class="absolute inset-x-0 bottom-0 p-4 bg-card/95 border-t flex flex-col gap-3">
          <p class="text-xs text-muted-foreground">Результат:</p>
          <p class="font-mono text-sm break-all">{{ scanner.result.value.text }}</p>
          <div class="flex gap-2">
            <button class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm" @click="handleResult(scanner.result.value!)">
              Открыть
            </button>
            <button class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm" @click="scanner.reset()">
              Сканировать ещё
            </button>
          </div>
        </div>

        <!-- Top bar: close + torch (visible during live state only) -->
        <div v-if="!scanner.result.value" class="absolute top-0 inset-x-0 p-4 flex justify-between bg-gradient-to-b from-black/60 to-transparent">
          <button class="text-white p-2" aria-label="Закрыть" @click="close">
            ✕
          </button>
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
  </Dialog>
</template>
