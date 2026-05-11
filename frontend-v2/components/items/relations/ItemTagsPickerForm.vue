<script setup lang="ts">
import { Search, X, Plus } from "lucide-vue-next";
import type { TagOut, TagSummary } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const props = defineProps<{
  modelValue: TagSummary[];
}>();

const emit = defineEmits<{
  "update:modelValue": [TagSummary[]];
}>();

const api = useUserApi();

const allTags = ref<TagOut[]>([]);
const search = ref("");
const inputFocused = ref(false);
const creating = ref(false);

async function load() {
  const resp = await api.tags.getAll();
  if (resp.data) allTags.value = resp.data;
}

onMounted(load);

const suggestions = computed(() => {
  const q = search.value.trim().toLowerCase();
  const selectedIds = new Set(props.modelValue.map(t => t.id));
  const pool = allTags.value.filter(t => !selectedIds.has(t.id));
  if (!q) return pool;
  return pool.filter(t => t.name.toLowerCase().includes(q));
});

const canCreateNew = computed(() => {
  const q = search.value.trim();
  if (!q) return false;
  const lower = q.toLowerCase();
  const inAll = allTags.value.some(t => t.name.toLowerCase() === lower);
  const inSelected = props.modelValue.some(t => t.name.toLowerCase() === lower);
  return !inAll && !inSelected;
});

function toSummary(t: TagOut): TagSummary {
  return {
    id: t.id,
    name: t.name,
    color: t.color,
    description: t.description,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function add(tag: TagOut | TagSummary) {
  if (props.modelValue.some(t => t.id === tag.id)) return;
  const summary: TagSummary = toSummary(tag as TagOut);
  emit("update:modelValue", [...props.modelValue, summary]);
  search.value = "";
}

function remove(id: string) {
  emit("update:modelValue", props.modelValue.filter(t => t.id !== id));
}

function clearAll() {
  emit("update:modelValue", []);
}

async function createInline() {
  const name = search.value.trim();
  if (!name || creating.value) return;
  creating.value = true;
  try {
    const resp = await api.tags.create({ name, color: "", description: "" });
    if (resp.error || !resp.data) {
      toast.error("Не удалось создать тег");
      return;
    }
    allTags.value = [...allTags.value, resp.data];
    add(resp.data);
  } finally {
    creating.value = false;
  }
}

function onInputBlur() {
  setTimeout(() => { inputFocused.value = false; }, 150);
}
</script>

<template>
  <div>
    <div class="relative">
      <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        v-model="search"
        type="text"
        class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Поиск или создание тега..."
        @focus="inputFocused = true"
        @blur="onInputBlur"
      />
    </div>
    <div
      v-if="inputFocused && (suggestions.length > 0 || canCreateNew)"
      class="mt-1 max-h-48 overflow-y-auto border border-border rounded-lg bg-card"
    >
      <button
        v-for="tag in suggestions"
        :key="tag.id"
        type="button"
        class="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
        @mousedown.prevent="add(tag)"
      >
        <div
          v-if="tag.color"
          class="w-2.5 h-2.5 rounded-full shrink-0"
          :style="{ backgroundColor: tag.color }"
        />
        <span>{{ tag.name }}</span>
      </button>
      <button
        v-if="canCreateNew"
        type="button"
        :disabled="creating"
        class="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors flex items-center gap-2 border-t border-border"
        @mousedown.prevent="createInline"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>{{ creating ? 'Создаём…' : `Создать тег «${search.trim()}»` }}</span>
      </button>
    </div>

    <div
      v-if="modelValue.length > 0"
      class="mt-2 flex flex-wrap gap-1.5"
    >
      <span
        v-for="tag in modelValue"
        :key="tag.id"
        class="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/5 border border-primary/20 rounded-full text-xs"
      >
        <span
          v-if="tag.color"
          class="w-2 h-2 rounded-full"
          :style="{ backgroundColor: tag.color }"
        />
        <span>{{ tag.name }}</span>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground"
          @click="remove(tag.id)"
        >
          <X class="w-3 h-3" />
        </button>
      </span>
    </div>

    <button
      v-if="modelValue.length > 0"
      type="button"
      class="mt-2 text-xs text-muted-foreground hover:text-foreground"
      @click="clearAll"
    >
      Очистить все
    </button>
  </div>
</template>
