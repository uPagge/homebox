<script setup lang="ts">
import { Search, X } from "lucide-vue-next";
import { useDebounceFn } from "@vueuse/core";
import type { ItemSummary } from "~~/lib/api/types/data-contracts";
import type { HomeboxTarget } from "~/lib/scanner/parse-homebox-url";
import { toast } from "vue-sonner";

const props = defineProps<{
  modelValue: ItemSummary | null;
  excludeId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [ItemSummary | null];
}>();

const api = useUserApi();
const tree = useLocationTree();

const search = ref("");
const results = ref<ItemSummary[]>([]);
const loading = ref(false);
let reqSeq = 0;

const debouncedSearch = useDebounceFn(async (q: string) => {
  if (!q.trim()) {
    results.value = [];
    loading.value = false;
    return;
  }
  const seq = ++reqSeq;
  const resp = await api.items.getAll({ q, pageSize: 10 });
  if (seq !== reqSeq) return;
  const items = resp.data?.items ?? [];
  results.value = props.excludeId ? items.filter(it => it.id !== props.excludeId) : items;
  loading.value = false;
}, 200);

watch(search, (val) => {
  if (props.modelValue) return;
  if (!val.trim()) {
    results.value = [];
    loading.value = false;
    reqSeq++;
    return;
  }
  loading.value = true;
  debouncedSearch(val);
});

function select(item: ItemSummary) {
  emit("update:modelValue", item);
  search.value = "";
  results.value = [];
}

function clear() {
  emit("update:modelValue", null);
  search.value = "";
  results.value = [];
}

async function onScanned(target: HomeboxTarget) {
  if (target.id === props.excludeId) {
    toast.error("Нельзя сделать вещь родителем самой себя");
    return;
  }
  const resp = await api.items.get(target.id);
  if (resp.error || !resp.data) {
    toast.error("Вещь не найдена");
    return;
  }
  select(resp.data as ItemSummary);
}
</script>

<template>
  <div>
    <div v-if="!modelValue" class="flex gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          v-model="search"
          type="text"
          class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Поиск вещи..."
        />
      </div>
      <ScannerPickerButton :accepts="['item']" @picked="onScanned" />
    </div>

    <div
      v-if="!modelValue && search"
      class="mt-1 max-h-48 overflow-y-auto border border-border rounded-lg bg-card"
    >
      <div v-if="loading" class="px-3 py-2 text-sm text-muted-foreground">
        Поиск...
      </div>
      <button
        v-for="it in results"
        :key="it.id"
        type="button"
        class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
        @click="select(it)"
      >
        <div class="text-sm">{{ it.name }}</div>
        <div v-if="it.location" class="text-xs text-muted-foreground truncate">
          {{ tree.getPathString(it.location.id) ?? it.location.name }}
        </div>
      </button>
      <div
        v-if="!loading && results.length === 0"
        class="px-3 py-2 text-sm text-muted-foreground"
      >
        Ничего не найдено
      </div>
    </div>

    <div
      v-else-if="modelValue"
      class="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm"
    >
      <div class="flex-1 min-w-0">
        <div class="truncate">{{ modelValue.name }}</div>
        <div v-if="modelValue.location" class="text-xs text-muted-foreground truncate">
          {{ tree.getPathString(modelValue.location.id) ?? modelValue.location.name }}
        </div>
      </div>
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground shrink-0"
        title="Очистить родителя"
        @click="clear"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
