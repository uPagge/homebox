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
