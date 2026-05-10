<script setup lang="ts">
import { ChevronDown, Pencil, Check, X } from "lucide-vue-next";

const props = defineProps<{
  title: string;
  editable?: boolean;
  editing?: boolean;
  collapsible?: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  save: [];
  cancel: [];
}>();

const collapsed = ref(false);
</script>

<template>
  <div class="border border-border rounded-xl overflow-hidden bg-card">
    <div class="flex items-center justify-between px-4 py-3 border-b border-border">
      <button
        v-if="collapsible"
        class="flex items-center gap-2 text-sm font-medium"
        @click="collapsed = !collapsed"
      >
        <ChevronDown
          class="w-4 h-4 transition-transform"
          :class="{ '-rotate-90': collapsed }"
        />
        {{ title }}
      </button>
      <span v-else class="text-sm font-medium">{{ title }}</span>

      <div class="flex items-center gap-1">
        <slot name="header-actions" />
        <template v-if="editable">
          <template v-if="editing">
            <button
              class="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors"
              @click="emit('save')"
            >
              <Check class="w-4 h-4" />
            </button>
            <button
              class="p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
              @click="emit('cancel')"
            >
              <X class="w-4 h-4" />
            </button>
          </template>
          <button
            v-else
            class="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            @click="emit('edit')"
          >
            <Pencil class="w-4 h-4" />
          </button>
        </template>
      </div>
    </div>

    <div v-show="!collapsed" class="p-4">
      <slot />
    </div>
  </div>
</template>
