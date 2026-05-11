<script setup lang="ts">
import type { LocationSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  open: boolean;
  value: LocationSummary | null;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  save: [LocationSummary];
}>();

const buffer = ref<LocationSummary | null>(props.value);

watch(() => props.open, (isOpen) => {
  if (isOpen) buffer.value = props.value;
});

function confirm() {
  if (!buffer.value) return;
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
        <DrawerTitle>Место</DrawerTitle>
      </DrawerHeader>
      <div class="px-4 pb-6 space-y-4">
        <ItemLocationPickerForm v-model="buffer" />
        <div class="flex gap-2 pt-2">
          <Button variant="outline" class="flex-1" @click="cancel">Отмена</Button>
          <Button class="flex-1" :disabled="!buffer" @click="confirm">Сохранить</Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
