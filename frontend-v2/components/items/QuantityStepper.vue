<script setup lang="ts">
import { Minus, Plus } from "lucide-vue-next";

const props = defineProps<{
  quantity: number;
  loading?: boolean;
}>();

const emit = defineEmits<{
  update: [quantity: number];
}>();

function decrement() {
  if (props.quantity > 1) {
    emit("update", props.quantity - 1);
  }
}

function increment() {
  emit("update", props.quantity + 1);
}
</script>

<template>
  <div class="flex items-center gap-1" @click.stop @click.prevent>
    <button
      class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 transition-colors"
      :disabled="quantity <= 1 || loading"
      @click="decrement"
    >
      <Minus class="w-3.5 h-3.5" />
    </button>
    <span class="text-sm font-medium min-w-[1.5rem] text-center tabular-nums">
      {{ quantity }}
    </span>
    <button
      class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 transition-colors"
      :disabled="loading"
      @click="increment"
    >
      <Plus class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
