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

const locationId = ref("");
const processing = ref(false);
const progress = ref(0);

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    locationId.value = "";
    progress.value = 0;
    processing.value = false;
  }
});

async function apply() {
  if (!locationId.value || props.items.length === 0) return;
  processing.value = true;
  progress.value = 0;

  let success = 0;
  for (const item of props.items) {
    const resp = await api.items.patch(item.id, { id: item.id, locationId: locationId.value });
    if (!resp.error) success++;
    progress.value++;
  }

  toast.success(`Перемещено ${success} из ${props.items.length}`);
  processing.value = false;
  emit("done");
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Переместить ({{ items.length }})</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <LocationPicker v-model="locationId" />

        <div v-if="processing" class="text-sm text-muted-foreground text-center">
          Обновлено {{ progress }} из {{ items.length }}...
        </div>

        <Button
          class="w-full"
          :disabled="!locationId || processing"
          @click="apply"
        >
          {{ processing ? `${progress}/${items.length}...` : 'Применить' }}
        </Button>
      </div>
    </DrawerContent>
  </Drawer>
</template>
