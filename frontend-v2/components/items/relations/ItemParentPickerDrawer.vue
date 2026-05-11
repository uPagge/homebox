<script setup lang="ts">
import type { ItemSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  open: boolean;
  value: ItemSummary | null;
  excludeId?: string;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  save: [ItemSummary | null];
}>();

const buffer = ref<ItemSummary | null>(props.value);

watch(() => props.open, (isOpen) => {
  if (isOpen) buffer.value = props.value;
});

function confirm() {
  emit("save", buffer.value);
  emit("update:open", false);
}

function cancel() {
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Родитель</DrawerTitle>
      </DrawerHeader>
      <div class="px-4 pb-6 space-y-4">
        <ItemParentPickerForm v-model="buffer" :exclude-id="excludeId" />
        <div class="flex gap-2 pt-2">
          <Button variant="outline" class="flex-1" @click="cancel">Отмена</Button>
          <Button class="flex-1" @click="confirm">Сохранить</Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
