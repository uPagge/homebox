<script setup lang="ts">
import { MapPin, TagsIcon, Minus, Copy, Trash2, Archive } from "lucide-vue-next";

defineProps<{
  count: number;
  archiveLabel?: string;
  hideMutating?: boolean;
}>();

const emit = defineEmits<{
  changeLocation: [];
  addTags: [];
  removeTags: [];
  duplicate: [];
  archive: [];
  delete: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div class="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-2xl shadow-lg">
        <span class="text-sm font-medium whitespace-nowrap tabular-nums">
          {{ count }}
        </span>

        <div class="w-px h-5 bg-border" />

        <template v-if="!hideMutating">
          <button
            class="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Переместить"
            @click="emit('changeLocation')"
          >
            <MapPin class="w-4 h-4" />
          </button>
          <button
            class="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Добавить теги"
            @click="emit('addTags')"
          >
            <TagsIcon class="w-4 h-4" />
          </button>
          <button
            class="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Убрать теги"
            @click="emit('removeTags')"
          >
            <Minus class="w-4 h-4" />
          </button>
          <button
            class="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Дублировать"
            @click="emit('duplicate')"
          >
            <Copy class="w-4 h-4" />
          </button>
        </template>
        <button
          class="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          :title="archiveLabel ?? 'Архивировать'"
          @click="emit('archive')"
        >
          <Archive class="w-4 h-4" />
        </button>

        <div class="w-px h-5 bg-border" />

        <button
          class="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
          title="Удалить"
          @click="emit('delete')"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </div>
  </Teleport>
</template>
