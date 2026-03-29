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

async function confirm() {
  if (props.items.length === 0) return;
  processing.value = true;
  progress.value = 0;

  let success = 0;
  for (const item of props.items) {
    const resp = await api.items.delete(item.id);
    if (!resp.error) success++;
    progress.value++;
  }

  toast.success(`Удалено ${success} из ${props.items.length}`);
  processing.value = false;
  emit("done");
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Удалить ({{ items.length }})</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <p class="text-sm text-muted-foreground">
          Удалить {{ items.length }} вещей? Это действие нельзя отменить.
        </p>

        <!-- Progress -->
        <div v-if="processing" class="text-sm text-muted-foreground text-center">
          Удалено {{ progress }} из {{ items.length }}...
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
            variant="destructive"
            class="flex-1"
            :disabled="processing"
            @click="confirm"
          >
            {{ processing ? `${progress}/${items.length}...` : 'Удалить' }}
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
