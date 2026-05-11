<script setup lang="ts">
import type { TagSummary } from "~~/lib/api/types/data-contracts";

const props = defineProps<{
  open: boolean;
  value: TagSummary[];
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  save: [TagSummary[]];
}>();

const buffer = ref<TagSummary[]>([...props.value]);

watch(() => props.open, (isOpen) => {
  if (isOpen) buffer.value = [...props.value];
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
        <DrawerTitle>Теги</DrawerTitle>
      </DrawerHeader>
      <div class="px-4 pb-6 space-y-4">
        <ItemTagsPickerForm v-model="buffer" />
        <div class="flex gap-2 pt-2">
          <Button variant="outline" class="flex-1" @click="cancel">Отмена</Button>
          <Button class="flex-1" @click="confirm">Сохранить</Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
