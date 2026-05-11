<script setup lang="ts">
import { Search, Camera, X, Plus } from "lucide-vue-next";
import { useDebounceFn } from "@vueuse/core";
import type { ItemSummary, LocationOutCount, TagOut } from "~~/lib/api/types/data-contracts";
import { AttachmentTypes } from "~~/lib/api/types/non-generated";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  contextLocationId?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

const api = useUserApi();

const name = ref("");
const locationId = ref("");
const quantity = ref(1);
const quantityMode = ref<"single" | "multiple">("single"); // single = 1 item with qty N, multiple = N separate items
const description = ref("");
const showMore = ref(false);
const saving = ref(false);

// Photo
const photoFile = ref<File | null>(null);
const photoPreview = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

function onPhotoSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  photoFile.value = file;
  photoPreview.value = URL.createObjectURL(file);
}

function removePhoto() {
  photoFile.value = null;
  if (photoPreview.value) {
    URL.revokeObjectURL(photoPreview.value);
    photoPreview.value = null;
  }
  if (fileInput.value) fileInput.value.value = "";
}

// Locations with search
const locations = ref<LocationOutCount[]>([]);
const locationSearch = ref("");
const tree = useLocationTree();

async function loadLocations() {
  const resp = await api.locations.getAll();
  if (resp.data) locations.value = resp.data;
}

const filteredLocations = computed(() => {
  if (!locationSearch.value) return locations.value;
  const q = locationSearch.value.toLowerCase();
  return locations.value.filter(l => l.name.toLowerCase().includes(q));
});

const selectedLocationName = computed(() => {
  const loc = locations.value.find(l => l.id === locationId.value);
  if (!loc) return "";
  return tree.getPathString(loc.id) ?? loc.name;
});

// Parent item picker (optional, inside "Больше подробностей")
const parentId = ref("");
const parentSearch = ref("");
const parentResults = ref<ItemSummary[]>([]);
const selectedParent = ref<ItemSummary | null>(null);
const parentLoading = ref(false);
let parentReqSeq = 0;

const debouncedParentSearch = useDebounceFn(async (q: string) => {
  if (!q.trim()) {
    parentResults.value = [];
    parentLoading.value = false;
    return;
  }
  const seq = ++parentReqSeq;
  const resp = await api.items.getAll({ q, pageSize: 10 });
  if (seq !== parentReqSeq) return;
  parentResults.value = resp.data?.items ?? [];
  parentLoading.value = false;
}, 200);

watch(parentSearch, (val) => {
  if (parentId.value) return;
  if (!val.trim()) {
    parentResults.value = [];
    parentLoading.value = false;
    parentReqSeq++;
    return;
  }
  parentLoading.value = true;
  debouncedParentSearch(val);
});

function selectParent(item: ItemSummary) {
  selectedParent.value = item;
  parentId.value = item.id;
  parentSearch.value = "";
  parentResults.value = [];
}

function clearParent() {
  selectedParent.value = null;
  parentId.value = "";
}

// Tags
const allTags = ref<TagOut[]>([]);
const tagSearch = ref("");
const selectedTags = ref<TagOut[]>([]);
const tagInputFocused = ref(false);
const tagCreating = ref(false);

async function loadTags() {
  const resp = await api.tags.getAll();
  if (resp.data) allTags.value = resp.data;
}

const tagSuggestions = computed(() => {
  const q = tagSearch.value.trim().toLowerCase();
  const selectedIds = new Set(selectedTags.value.map(t => t.id));
  const pool = allTags.value.filter(t => !selectedIds.has(t.id));
  if (!q) return pool;
  return pool.filter(t => t.name.toLowerCase().includes(q));
});

const canCreateNewTag = computed(() => {
  const q = tagSearch.value.trim();
  if (!q) return false;
  const lower = q.toLowerCase();
  const existsInAll = allTags.value.some(t => t.name.toLowerCase() === lower);
  const existsInSelected = selectedTags.value.some(t => t.name.toLowerCase() === lower);
  return !existsInAll && !existsInSelected;
});

function selectTag(tag: TagOut) {
  if (selectedTags.value.some(t => t.id === tag.id)) return;
  selectedTags.value = [...selectedTags.value, tag];
  tagSearch.value = "";
}

function removeTag(id: string) {
  selectedTags.value = selectedTags.value.filter(t => t.id !== id);
}

async function createTagInline() {
  const name = tagSearch.value.trim();
  if (!name || tagCreating.value) return;
  tagCreating.value = true;
  try {
    const resp = await api.tags.create({ name, color: "", description: "" });
    if (resp.error || !resp.data) {
      toast.error("Не удалось создать тег");
      return;
    }
    allTags.value = [...allTags.value, resp.data];
    selectedTags.value = [...selectedTags.value, resp.data];
    tagSearch.value = "";
  } finally {
    tagCreating.value = false;
  }
}

function onTagInputBlur() {
  setTimeout(() => { tagInputFocused.value = false; }, 150);
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadLocations();
    loadTags();
    locationSearch.value = "";
  }
});

// Remember last used location
const lastLocationId = useLocalStorage<string>("homebox-v2/last-location", "");

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    // Priority: context location (from current page) > last used > empty
    if (props.contextLocationId) {
      locationId.value = props.contextLocationId;
    } else if (lastLocationId.value && !locationId.value) {
      locationId.value = lastLocationId.value;
    }
  }
});

async function save(addNext: boolean) {
  if (!name.value || !locationId.value) return;

  saving.value = true;
  try {
    if (quantityMode.value === "multiple" && quantity.value > 1) {
      // Create N separate items
      for (let i = 0; i < quantity.value; i++) {
        const resp = await api.items.create({
          name: name.value,
          locationId: locationId.value,
          quantity: 1,
          description: description.value,
          tagIds: selectedTags.value.map(t => t.id),
          parentId: parentId.value || undefined,
        });
        if (resp.error) {
          toast.error(`Не удалось создать вещь (${i + 1}/${quantity.value})`);
          return;
        }
        if (photoFile.value && resp.data) {
          try {
            await api.items.attachments.add(resp.data.id, photoFile.value, photoFile.value.name, AttachmentTypes.Photo, true);
          } catch {
            toast.error(`Фото не загрузилось (${i + 1}/${quantity.value})`);
          }
        }
      }
      toast.success(`Создано ${quantity.value} × «${name.value}»`);
    } else {
      // Single item with quantity
      const resp = await api.items.create({
        name: name.value,
        locationId: locationId.value,
        quantity: quantity.value,
        description: description.value,
        tagIds: selectedTags.value.map(t => t.id),
        parentId: parentId.value || undefined,
      });

      if (resp.error) {
        toast.error("Не удалось создать вещь");
        return;
      }

      if (photoFile.value && resp.data) {
        try {
          await api.items.attachments.add(resp.data.id, photoFile.value, photoFile.value.name, AttachmentTypes.Photo, true);
        } catch {
          toast.error("Вещь создана, но фото не загрузилось");
        }
      }
      toast.success(`«${name.value}» добавлена`);
    }

    lastLocationId.value = locationId.value;
    emit("created");

    if (addNext) {
      name.value = "";
      quantity.value = 1;
      description.value = "";
      showMore.value = false;
      removePhoto();
      clearParent();
      parentSearch.value = "";
      parentResults.value = [];
      selectedTags.value = [];
      tagSearch.value = "";
    } else {
      resetAndClose();
    }
  } finally {
    saving.value = false;
  }
}

function resetAndClose() {
  name.value = "";
  locationId.value = lastLocationId.value;
  quantity.value = 1;
  quantityMode.value = "single";
  description.value = "";
  showMore.value = false;
  locationSearch.value = "";
  removePhoto();
  clearParent();
  parentSearch.value = "";
  parentResults.value = [];
  selectedTags.value = [];
  tagSearch.value = "";
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Добавить вещь</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <!-- Name -->
        <div>
          <label class="text-sm font-medium" for="qa-name">Название</label>
          <input
            id="qa-name"
            v-model="name"
            type="text"
            required
            autofocus
            class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Что добавляем?"
          />
        </div>

        <!-- Location with search -->
        <div>
          <label class="text-sm font-medium">Место</label>
          <div class="mt-1 relative">
            <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              v-model="locationSearch"
              type="text"
              class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              :placeholder="selectedLocationName || 'Поиск локации...'"
            />
          </div>
          <div
            v-if="locationSearch || !locationId"
            class="mt-1 max-h-36 overflow-y-auto border border-border rounded-lg bg-card"
          >
            <button
              v-for="loc in filteredLocations"
              :key="loc.id"
              class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
              :class="loc.id === locationId ? 'bg-primary/10 text-primary font-medium' : ''"
              @click="locationId = loc.id; locationSearch = ''"
            >
              <div class="text-sm">{{ loc.name }}</div>
              <div
                v-if="tree.getParentPathString(loc.id)"
                class="text-xs text-muted-foreground truncate"
              >
                {{ tree.getParentPathString(loc.id) }}
              </div>
            </button>
            <div
              v-if="filteredLocations.length === 0"
              class="px-3 py-2 text-sm text-muted-foreground"
            >
              Ничего не найдено
            </div>
          </div>
          <div
            v-else-if="locationId && selectedLocationName"
            class="mt-1 flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-sm"
          >
            <span class="flex-1">{{ selectedLocationName }}</span>
            <button
              class="text-muted-foreground hover:text-foreground"
              @click="locationId = ''"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Photo -->
        <div>
          <label class="text-sm font-medium">Фото</label>
          <div class="mt-1">
            <div v-if="photoPreview" class="relative inline-block">
              <img
                :src="photoPreview"
                class="w-20 h-20 object-cover rounded-lg border border-border"
              />
              <button
                class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                @click="removePhoto"
              >
                <X class="w-3 h-3" />
              </button>
            </div>
            <button
              v-else
              class="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
              @click="fileInput?.click()"
            >
              <Camera class="w-4 h-4" />
              Добавить фото
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              capture="environment"
              class="hidden"
              @change="onPhotoSelect"
            />
          </div>
        </div>

        <!-- Quantity -->
        <div>
          <label class="text-sm font-medium">Количество</label>
          <div class="mt-1">
            <QuantityStepper :quantity="quantity" @update="quantity = $event" />
          </div>
          <div v-if="quantity > 1" class="mt-2 flex gap-1">
            <button
              class="flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors"
              :class="quantityMode === 'single'
                ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                : 'border-border text-muted-foreground hover:bg-accent'"
              @click="quantityMode = 'single'"
            >
              1 вещь × {{ quantity }} шт
            </button>
            <button
              class="flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors"
              :class="quantityMode === 'multiple'
                ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                : 'border-border text-muted-foreground hover:bg-accent'"
              @click="quantityMode = 'multiple'"
            >
              {{ quantity }} отдельных вещей
            </button>
          </div>
        </div>

        <!-- More details toggle -->
        <button
          class="text-sm text-primary hover:underline"
          @click="showMore = !showMore"
        >
          {{ showMore ? 'Скрыть подробности' : 'Больше подробностей' }}
        </button>

        <!-- Extended fields -->
        <div v-if="showMore" class="space-y-4">
          <div>
            <label class="text-sm font-medium" for="qa-description">Описание</label>
            <Textarea
              id="qa-description"
              v-model="description"
              class="mt-1"
              placeholder="Описание вещи"
              rows="3"
            />
          </div>

          <!-- Tags -->
          <div>
            <label class="text-sm font-medium">Теги</label>
            <div class="mt-1 relative">
              <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                v-model="tagSearch"
                type="text"
                class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Поиск или создание тега..."
                @focus="tagInputFocused = true"
                @blur="onTagInputBlur"
              />
            </div>
            <div
              v-if="tagInputFocused && (tagSuggestions.length > 0 || canCreateNewTag)"
              class="mt-1 max-h-36 overflow-y-auto border border-border rounded-lg bg-card"
            >
              <button
                v-for="tag in tagSuggestions"
                :key="tag.id"
                type="button"
                class="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                @mousedown.prevent="selectTag(tag)"
              >
                <div
                  v-if="tag.color"
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :style="{ backgroundColor: tag.color }"
                />
                <span>{{ tag.name }}</span>
              </button>
              <button
                v-if="canCreateNewTag"
                type="button"
                :disabled="tagCreating"
                class="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors flex items-center gap-2 border-t border-border"
                @mousedown.prevent="createTagInline"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>{{ tagCreating ? 'Создаём…' : `Создать тег «${tagSearch.trim()}»` }}</span>
              </button>
            </div>
            <div
              v-if="selectedTags.length > 0"
              class="mt-2 flex flex-wrap gap-1.5"
            >
              <span
                v-for="tag in selectedTags"
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
                  @click="removeTag(tag.id)"
                >
                  <X class="w-3 h-3" />
                </button>
              </span>
            </div>
          </div>

          <!-- Parent item (optional) -->
          <div>
            <label class="text-sm font-medium">Родительская вещь</label>
            <div v-if="!selectedParent" class="mt-1 relative">
              <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                v-model="parentSearch"
                type="text"
                class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Поиск вещи..."
              />
            </div>
            <div
              v-if="!selectedParent && parentSearch"
              class="mt-1 max-h-36 overflow-y-auto border border-border rounded-lg bg-card"
            >
              <div
                v-if="parentLoading"
                class="px-3 py-2 text-sm text-muted-foreground"
              >
                Поиск...
              </div>
              <button
                v-for="item in parentResults"
                :key="item.id"
                class="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                @click="selectParent(item)"
              >
                <div class="text-sm">{{ item.name }}</div>
                <div v-if="item.location" class="text-xs text-muted-foreground truncate">
                  {{ tree.getPathString(item.location.id) ?? item.location.name }}
                </div>
              </button>
              <div
                v-if="!parentLoading && parentResults.length === 0"
                class="px-3 py-2 text-sm text-muted-foreground"
              >
                Ничего не найдено
              </div>
            </div>
            <div
              v-else-if="selectedParent"
              class="mt-1 flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-sm"
            >
              <span class="flex-1 truncate">
                {{ selectedParent.name }}
                <span v-if="selectedParent.location" class="text-muted-foreground">
                  · {{ tree.getPathString(selectedParent.location.id) ?? selectedParent.location.name }}
                </span>
              </span>
              <button
                class="text-muted-foreground hover:text-foreground"
                @click="clearParent"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 pt-2">
          <Button
            class="flex-1"
            :disabled="!name || !locationId || saving"
            @click="save(false)"
          >
            {{ saving ? 'Сохраняем...' : 'Сохранить' }}
          </Button>
          <Button
            variant="outline"
            class="flex-1"
            :disabled="!name || !locationId || saving"
            @click="save(true)"
          >
            Сохранить и ещё
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
