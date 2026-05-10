<script setup lang="ts">
import { toast } from "vue-sonner";
import { Lightbulb, ChevronsUpDown, Check } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  parentId?: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

const api = useUserApi();
const tree = useLocationTree();

const name = ref("");
const description = ref("");
const selectedParentId = ref<string>(props.parentId ?? "");
const saving = ref(false);

const suggest = useLocationNameSuggest(name);

function applySuggestion() {
  const s = suggest.value.suggestion;
  if (!s) return;
  name.value = s.name;
  // shadcn-vue Textarea exposes a component instance, not the <textarea>;
  // query the DOM by id instead.
  document.getElementById("loc-desc")?.focus();
}

// Parent picker — searchable inline list with full hierarchy paths.
const parentPickerOpen = ref(false);
const parentSearch = ref("");

const parentOptions = computed(() => tree.getAll());

const filteredParentOptions = computed(() => {
  const q = parentSearch.value.trim().toLocaleLowerCase();
  if (!q) return parentOptions.value;
  return parentOptions.value.filter(loc =>
    loc.pathString.toLocaleLowerCase().includes(q)
  );
});

const selectedParentLabel = computed(() => {
  if (!selectedParentId.value) return "Без родителя (корневая)";
  return tree.getPathString(selectedParentId.value) ?? "—";
});

function selectParent(id: string) {
  selectedParentId.value = id;
  parentPickerOpen.value = false;
  parentSearch.value = "";
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selectedParentId.value = props.parentId ?? "";
    parentPickerOpen.value = false;
    parentSearch.value = "";
  }
});

async function save() {
  if (!name.value) return;

  saving.value = true;
  try {
    const body: { name: string; description: string; parentId?: string } = {
      name: name.value,
      description: description.value,
    };
    if (selectedParentId.value) {
      body.parentId = selectedParentId.value;
    }

    const resp = await api.locations.create(body);
    if (resp.error) {
      toast.error("Не удалось создать локацию");
      return;
    }

    toast.success(`«${name.value}» создана`);
    tree.invalidate();
    resetAndClose();
    emit("created");
  } finally {
    saving.value = false;
  }
}

function resetAndClose() {
  name.value = "";
  description.value = "";
  selectedParentId.value = "";
  parentPickerOpen.value = false;
  parentSearch.value = "";
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Новая локация</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <!-- Name -->
        <div>
          <label class="text-sm font-medium" for="loc-name">Название</label>
          <input
            id="loc-name"
            v-model="name"
            type="text"
            required
            autofocus
            class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Название локации"
          />
        </div>

        <div
          v-if="suggest.suggestion"
          class="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2"
        >
          <div class="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Lightbulb class="w-3.5 h-3.5" />
            <span>Уже создано:</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="loc in suggest.existing"
              :key="loc.id"
              class="px-2 py-0.5 bg-card border border-border rounded-md text-xs"
              :title="loc.pathString"
            >
              {{ loc.pathString || loc.name }}
            </span>
          </div>
          <div class="flex items-center gap-2 pt-1">
            <span class="text-xs text-muted-foreground">Предложение:</span>
            <button
              type="button"
              class="px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
              @click="applySuggestion"
            >
              {{ suggest.suggestion.name }}
            </button>
          </div>
        </div>

        <!-- Description -->
        <div>
          <label class="text-sm font-medium" for="loc-desc">Описание</label>
          <Textarea
            id="loc-desc"
            v-model="description"
            class="mt-1"
            placeholder="Описание (необязательно)"
            rows="2"
          />
        </div>

        <!-- Parent location — searchable picker -->
        <div>
          <label class="text-sm font-medium">Родительская локация</label>
          <button
            type="button"
            class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring"
            @click="parentPickerOpen = !parentPickerOpen"
          >
            <span class="truncate text-left" :class="!selectedParentId && 'text-muted-foreground'">
              {{ selectedParentLabel }}
            </span>
            <ChevronsUpDown class="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
          </button>

          <div
            v-if="parentPickerOpen"
            class="mt-1 border border-input rounded-lg bg-card overflow-hidden"
          >
            <div class="p-2 border-b border-border">
              <input
                v-model="parentSearch"
                type="text"
                placeholder="Поиск..."
                class="w-full px-2 py-1.5 bg-background border border-input rounded text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div class="max-h-56 overflow-y-auto py-1">
              <button
                type="button"
                class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                :class="!selectedParentId && 'bg-accent/50'"
                @click="selectParent('')"
              >
                <Check v-if="!selectedParentId" class="w-3.5 h-3.5 text-primary" />
                <span v-else class="w-3.5 h-3.5 shrink-0" />
                <span>Без родителя (корневая)</span>
              </button>
              <button
                v-for="loc in filteredParentOptions"
                :key="loc.id"
                type="button"
                class="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                :class="selectedParentId === loc.id && 'bg-accent/50'"
                @click="selectParent(loc.id)"
              >
                <Check v-if="selectedParentId === loc.id" class="w-3.5 h-3.5 text-primary" />
                <span v-else class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">{{ loc.pathString }}</span>
              </button>
              <div
                v-if="filteredParentOptions.length === 0 && parentSearch"
                class="px-3 py-3 text-sm text-muted-foreground"
              >
                Ничего не найдено
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 pt-2">
          <Button
            class="flex-1"
            :disabled="!name || saving"
            @click="save"
          >
            {{ saving ? 'Создаём...' : 'Создать' }}
          </Button>
          <Button
            variant="outline"
            @click="resetAndClose"
          >
            Отмена
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
