<script setup lang="ts">
import { type AlertDialogProps, AlertDialogRoot } from 'reka-ui'

const props = defineProps<AlertDialogProps>()
const emits = defineEmits<{ "update:open": [value: boolean] }>()

const onOpenChange = (open: boolean) => emits("update:open", open)
</script>

<template>
  <AlertDialogRoot :open="props.open" :default-open="props.defaultOpen" @update:open="onOpenChange">
    <slot />
  </AlertDialogRoot>
</template>
