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

// Hide rather than disable when the platform lacks a camera: disabled-with-tooltip
// adds noise on desktops where the user can never use the feature anyway.
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

function mismatchMessage(accepts: readonly ScanPickKind[]): string {
  if (accepts.length === 1 && accepts[0] === "location") return "Ожидается локация";
  if (accepts.length === 1 && accepts[0] === "item") return "Ожидается вещь";
  return "Не подходит для этого поля";
}

function onScan(r: ScanResult): void {
  const action = decideScanPickAction(r.text, props.accepts);
  switch (action.type) {
    case "pick":
      open.value = false;
      emit("picked", action.target);
      return;
    case "mismatch":
      toast.error(mismatchMessage(action.accepts));
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
