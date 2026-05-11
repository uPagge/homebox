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
  buttonClass?: string;
}>();

const emit = defineEmits<{
  picked: [target: HomeboxTarget];
}>();

const open = ref(false);

// Hide on platforms without camera or in insecure contexts (http on non-localhost).
// Same pattern as NiimbotPrint uses for Web Bluetooth.
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
