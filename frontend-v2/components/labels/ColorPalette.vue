<script setup lang="ts">
import { Check } from "lucide-vue-next";

const COLORS = [
  { name: "Красный", value: "#ef4444" },
  { name: "Оранжевый", value: "#f97316" },
  { name: "Жёлтый", value: "#f59e0b" },
  { name: "Зелёный", value: "#22c55e" },
  { name: "Бирюзовый", value: "#14b8a6" },
  { name: "Синий", value: "#3b82f6" },
  { name: "Фиолетовый", value: "#8b5cf6" },
  { name: "Розовый", value: "#ec4899" },
  { name: "Серый", value: "#6b7280" },
];

const model = defineModel<string>({ default: "#ef4444" });
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="color in COLORS"
      :key="color.value"
      type="button"
      class="w-8 h-8 rounded-full flex items-center justify-center transition-all ring-offset-background"
      :class="model === color.value ? 'ring-2 ring-ring ring-offset-2' : 'hover:scale-110'"
      :style="{ backgroundColor: color.value }"
      :title="color.name"
      @click="model = color.value"
    >
      <Check v-if="model === color.value" class="w-4 h-4 text-white" />
    </button>
  </div>
</template>
