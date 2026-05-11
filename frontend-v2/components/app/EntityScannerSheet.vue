<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from "vue";
import { DialogRoot } from "reka-ui";
import { Flashlight, FlashlightOff } from "lucide-vue-next";
import { useScanner, type ScanResult } from "~/composables/use-scanner";
import { useNfcReader } from "~/composables/use-nfc-reader";
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

const nfc = useNfcReader();

watch(
  () => props.open,
  async (val) => {
    if (val) {
      await nextTick();
      if (videoEl.value) await scanner.start(videoEl.value);
      if (nfc.isSupported.value) await nfc.start();
    } else {
      scanner.stop();
      nfc.stop();
    }
  },
);

watch(
  () => scanner.result.value,
  (r) => {
    if (!r) return;
    emit("scan", r);
    scanner.reset();
  },
);

const unsubscribeNfc = nfc.onResult((r) => {
  emit("scan", r);
  scanner.reset();
  nfc.stop();
});

onUnmounted(() => {
  scanner.stop();
  nfc.stop();
  unsubscribeNfc();
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

        <div class="pointer-events-none absolute inset-0">
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 max-w-[70vw] max-h-[70vw]">
            <div class="absolute inset-0 bg-transparent rounded-md" style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.4);" />
            <div class="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl" />
            <div class="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr" />
            <div class="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl" />
            <div class="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br" />
          </div>
        </div>

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
