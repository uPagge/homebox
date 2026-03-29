<script setup lang="ts">
const props = defineProps<{
  name: string;
  size?: "sm" | "md" | "lg";
}>();

const initials = computed(() => {
  const words = props.name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return props.name.slice(0, 2).toUpperCase();
});

// Deterministic color from name
const colorClass = computed(() => {
  let hash = 0;
  for (let i = 0; i < props.name.length; i++) {
    hash = props.name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-red-500/15 text-red-700 dark:text-red-400",
    "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    "bg-green-500/15 text-green-700 dark:text-green-400",
    "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    "bg-teal-500/15 text-teal-700 dark:text-teal-400",
    "bg-pink-500/15 text-pink-700 dark:text-pink-400",
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  ];
  return colors[Math.abs(hash) % colors.length];
});

const sizeClass = computed(() => {
  switch (props.size) {
    case "sm": return "w-8 h-8 text-xs";
    case "lg": return "w-16 h-16 text-xl";
    default: return "w-10 h-10 text-sm";
  }
});
</script>

<template>
  <div
    class="rounded-lg flex items-center justify-center font-semibold shrink-0"
    :class="[colorClass, sizeClass]"
  >
    {{ initials }}
  </div>
</template>
