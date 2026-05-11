<script setup lang="ts">
import type { ItemSummary } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  items: ItemSummary[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  done: [];
}>();

const api = useUserApi();
const processing = ref(false);
const progress = ref(0);

const action = computed<"archive" | "unarchive">(() => {
  return props.items.some(i => !i.archived) ? "archive" : "unarchive";
});

const actionLabel = computed(() => action.value === "archive" ? "Архивировать" : "Вернуть из архива");

async function confirm() {
  if (props.items.length === 0) return;
  processing.value = true;
  progress.value = 0;
  const target = action.value === "archive";

  let success = 0;
  for (const item of props.items) {
    const resp = await api.items.patch(item.id, { id: item.id, archived: target });
    if (!resp.error) success++;
    progress.value++;
  }

  toast.success(`${actionLabel.value}: ${success} из ${props.items.length}`);
  processing.value = false;
  emit("done");
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>{{ actionLabel }} ({{ items.length }})</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <p class="text-sm text-muted-foreground">
          {{ action === "archive"
            ? `Архивировать ${items.length} вещей? Они скроются из обычных списков.`
            : `Вернуть ${items.length} вещей из архива?` }}
        </p>

        <div v-if="processing" class="text-sm text-muted-foreground text-center">
          {{ actionLabel }}: {{ progress }} из {{ items.length }}...
        </div>

        <div class="flex gap-2">
          <Button
            variant="outline"
            class="flex-1"
            :disabled="processing"
            @click="emit('update:open', false)"
          >
            Отмена
          </Button>
          <Button
            class="flex-1"
            :disabled="processing"
            @click="confirm"
          >
            {{ processing ? `${progress}/${items.length}...` : actionLabel }}
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
