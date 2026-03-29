<script setup lang="ts">
import type { LocationOutCount } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

const api = useUserApi();

const name = ref("");
const locationId = ref("");
const quantity = ref(1);
const description = ref("");
const showMore = ref(false);
const saving = ref(false);

// Load locations for picker
const locations = ref<LocationOutCount[]>([]);
async function loadLocations() {
  const resp = await api.locations.getAll();
  if (resp.data) locations.value = resp.data;
}

watch(() => props.open, (isOpen) => {
  if (isOpen) loadLocations();
});

// Remember last used location
const lastLocationId = useLocalStorage<string>("homebox-v2/last-location", "");

watch(() => props.open, (isOpen) => {
  if (isOpen && lastLocationId.value && !locationId.value) {
    locationId.value = lastLocationId.value;
  }
});

async function save(addNext: boolean) {
  if (!name.value || !locationId.value) return;

  saving.value = true;
  try {
    const resp = await api.items.create({
      name: name.value,
      locationId: locationId.value,
      quantity: quantity.value,
      description: description.value,
      tagIds: [],
    });

    if (resp.error) {
      toast.error("Не удалось создать вещь");
      return;
    }

    lastLocationId.value = locationId.value;
    toast.success(`«${name.value}» добавлена`);
    emit("created");

    if (addNext) {
      // Reset for next — keep location
      name.value = "";
      quantity.value = 1;
      description.value = "";
      showMore.value = false;
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
  description.value = "";
  showMore.value = false;
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Добавить вещь</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
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
          <label class="text-sm font-medium" for="qa-location">Место</label>
          <select
            id="qa-location"
            v-model="locationId"
            class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>Выберите место</option>
            <option v-for="loc in locations" :key="loc.id" :value="loc.id">
              {{ loc.name }}
            </option>
          </select>
        </div>

        <!-- Quantity -->
        <div>
          <label class="text-sm font-medium">Количество</label>
          <div class="mt-1">
            <QuantityStepper :quantity="quantity" @update="quantity = $event" />
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
