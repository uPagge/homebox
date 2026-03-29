<script setup lang="ts">
import { Check } from "lucide-vue-next";
import type { ItemSummary, TagOut } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  items: ItemSummary[];
  mode: "add" | "remove";
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  done: [];
}>();

const api = useUserApi();

const allTags = ref<TagOut[]>([]);
const selectedTagIds = ref<Set<string>>(new Set());
const processing = ref(false);
const progress = ref(0);

// Tags that exist on at least one selected item (for remove mode)
const unionTagIds = computed(() => {
  const ids = new Set<string>();
  for (const item of props.items) {
    for (const tag of item.tags) {
      ids.add(tag.id);
    }
  }
  return ids;
});

// Tags common to ALL selected items (for add mode — hide those already on all)
const intersectTagIds = computed(() => {
  if (props.items.length === 0) return new Set<string>();
  const sets = props.items.map(item => new Set(item.tags.map(t => t.id)));
  const first = sets[0]!;
  const result = new Set<string>();
  for (const id of first) {
    if (sets.every(s => s.has(id))) result.add(id);
  }
  return result;
});

const availableTags = computed(() => {
  if (props.mode === "add") {
    // Show tags NOT already on all items
    return allTags.value.filter(t => !intersectTagIds.value.has(t.id));
  } else {
    // Show tags present on at least one item
    return allTags.value.filter(t => unionTagIds.value.has(t.id));
  }
});

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    selectedTagIds.value = new Set();
    progress.value = 0;
    processing.value = false;
    const resp = await api.tags.getAll();
    if (resp.data) allTags.value = resp.data;
  }
});

function toggleTag(id: string) {
  const s = new Set(selectedTagIds.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  selectedTagIds.value = s;
}

async function apply() {
  if (selectedTagIds.value.size === 0 || props.items.length === 0) return;
  processing.value = true;
  progress.value = 0;

  let success = 0;
  for (const item of props.items) {
    const currentTagIds = item.tags.map(t => t.id);
    let newTagIds: string[];

    if (props.mode === "add") {
      const addSet = new Set([...currentTagIds, ...selectedTagIds.value]);
      newTagIds = [...addSet];
    } else {
      newTagIds = currentTagIds.filter(id => !selectedTagIds.value.has(id));
    }

    const resp = await api.items.patch(item.id, { id: item.id, tagIds: newTagIds });
    if (!resp.error) success++;
    progress.value++;
  }

  const action = props.mode === "add" ? "Теги добавлены" : "Теги убраны";
  toast.success(`${action}: ${success} из ${props.items.length}`);
  processing.value = false;
  emit("done");
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>
          {{ mode === "add" ? "Добавить теги" : "Убрать теги" }} ({{ items.length }})
        </DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <!-- Tag list -->
        <div class="max-h-64 overflow-y-auto space-y-1">
          <button
            v-for="tag in availableTags"
            :key="tag.id"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors text-left"
            @click="toggleTag(tag.id)"
          >
            <div
              class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="selectedTagIds.has(tag.id)
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-muted-foreground/40'"
            >
              <Check v-if="selectedTagIds.has(tag.id)" class="w-3 h-3" />
            </div>
            <div class="flex items-center gap-2">
              <div
                v-if="tag.color"
                class="w-2.5 h-2.5 rounded-full shrink-0"
                :style="{ backgroundColor: tag.color }"
              />
              <span>{{ tag.name }}</span>
            </div>
          </button>

          <div
            v-if="availableTags.length === 0"
            class="px-3 py-4 text-sm text-muted-foreground text-center"
          >
            {{ mode === "add" ? "Все теги уже назначены" : "Нет тегов для удаления" }}
          </div>
        </div>

        <!-- Progress -->
        <div v-if="processing" class="text-sm text-muted-foreground text-center">
          Обновлено {{ progress }} из {{ items.length }}...
        </div>

        <!-- Apply button -->
        <Button
          class="w-full"
          :disabled="selectedTagIds.size === 0 || processing"
          @click="apply"
        >
          {{ processing ? `${progress}/${items.length}...` : 'Применить' }}
        </Button>
      </div>
    </DrawerContent>
  </Drawer>
</template>
