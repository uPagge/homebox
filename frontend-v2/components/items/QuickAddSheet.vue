<script setup lang="ts">
import { Camera, X } from "lucide-vue-next";
import type { ItemSummary, LocationSummary, TagSummary } from "~~/lib/api/types/data-contracts";
import { AttachmentTypes } from "~~/lib/api/types/non-generated";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  contextLocationId?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [addNext: boolean];
}>();

const api = useUserApi();

const name = ref("");
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

// Relations (picker-managed state)
const selectedLocation = ref<LocationSummary | null>(null);
const selectedParent = ref<ItemSummary | null>(null);
const selectedTags = ref<TagSummary[]>([]);
const locationId = computed(() => selectedLocation.value?.id ?? "");

// Remember last used location
const lastLocationId = useLocalStorage<string>("homebox-v2/last-location", "");

// On open: prefill location from context or last-used
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return;
  const wantedId = props.contextLocationId || lastLocationId.value;
  if (wantedId && !selectedLocation.value) {
    const resp = await api.locations.getAll();
    const loc = resp.data?.find(l => l.id === wantedId);
    if (loc) {
      selectedLocation.value = {
        id: loc.id,
        name: loc.name,
        description: loc.description ?? "",
        createdAt: loc.createdAt ?? "",
        updatedAt: loc.updatedAt ?? "",
      };
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
          parentId: selectedParent.value?.id || undefined,
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
        parentId: selectedParent.value?.id || undefined,
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
    emit("created", addNext);

    if (addNext) {
      name.value = "";
      quantity.value = 1;
      description.value = "";
      showMore.value = false;
      removePhoto();
      selectedParent.value = null;
      selectedTags.value = [];
    } else {
      resetAndClose();
    }
  } finally {
    saving.value = false;
  }
}

function resetAndClose() {
  name.value = "";
  selectedLocation.value = null;
  quantity.value = 1;
  quantityMode.value = "single";
  description.value = "";
  showMore.value = false;
  removePhoto();
  selectedParent.value = null;
  selectedTags.value = [];
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

        <!-- Location -->
        <div>
          <label class="text-sm font-medium">Место</label>
          <div class="mt-1">
            <ItemLocationPickerForm v-model="selectedLocation" />
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
            <div class="mt-1">
              <ItemTagsPickerForm v-model="selectedTags" />
            </div>
          </div>

          <!-- Parent item (optional) -->
          <div>
            <label class="text-sm font-medium">Родительская вещь</label>
            <div class="mt-1">
              <ItemParentPickerForm v-model="selectedParent" />
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
