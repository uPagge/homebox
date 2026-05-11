<script setup lang="ts">
import { computed, watch, onUnmounted } from "vue";
import { DialogRoot } from "reka-ui";
import { Nfc, X } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useNfcWriter, mapNfcWriteError, buildTagUrl } from "~/composables/use-nfc-writer";
import type { HomeboxTarget } from "~/lib/scanner/parse-homebox-url";

const props = defineProps<{
  open: boolean;
  target: HomeboxTarget;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const writer = useNfcWriter();

const previewUrl = computed(() =>
  typeof window === "undefined" ? "" : buildTagUrl(props.target, window.location.origin),
);

watch(
  () => props.open,
  async (val) => {
    if (!val) return;
    try {
      await writer.write(props.target);
      toast.success("Тег записан");
      emit("update:open", false);
    } catch (e) {
      const err = mapNfcWriteError(e);
      switch (err.kind) {
        case "cancelled":
          break;
        case "permission_denied":
          toast.error("Разрешите NFC в настройках браузера");
          emit("update:open", false);
          break;
        case "tag_locked":
          toast.error("Тег защищён от записи");
          emit("update:open", false);
          break;
        case "timeout":
          toast.error("Тег не поднесён");
          emit("update:open", false);
          break;
        case "tag_removed":
          toast.error("Запись прервана, держите тег ровно");
          emit("update:open", false);
          break;
        case "read_error":
          toast.error(`Не удалось записать тег: ${err.cause}`);
          emit("update:open", false);
          break;
      }
    }
  },
);

function close(): void {
  writer.cancel();
  emit("update:open", false);
}

onUnmounted(() => writer.cancel());
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => !v && close()">
    <DialogContent class="max-w-md p-6">
      <DialogTitle class="text-lg font-medium mb-4">Запись NFC-тега</DialogTitle>

      <div class="flex flex-col items-center gap-4 py-4">
        <div class="relative">
          <Nfc class="w-16 h-16 text-primary animate-pulse" />
        </div>
        <p class="text-center text-sm">
          Поднесите NFC-тег к задней крышке телефона
        </p>
        <div class="w-full px-3 py-2 bg-muted rounded-md text-xs text-muted-foreground break-all">
          {{ previewUrl }}
        </div>
      </div>

      <div class="flex justify-end pt-2">
        <button
          class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm flex items-center gap-2"
          @click="close"
        >
          <X class="w-4 h-4" />
          Отмена
        </button>
      </div>
    </DialogContent>
  </DialogRoot>
</template>
