<script setup lang="ts">
import {
  ArrowLeft, MapPin, Tag, Copy, Trash2,
  Shield, ShieldAlert, ShieldCheck,
  Paperclip, Star, ScanLine,
  Archive, ArchiveRestore, Boxes,
} from "lucide-vue-next";
import type { ItemOut, ItemSummary, LocationOutCount } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

definePageMeta({ layout: "default" });

const route = useRoute();
const router = useRouter();
const api = useUserApi();
const { attachmentUrl: makeAttachmentUrl } = useAttachmentUrl();
const itemId = computed(() => route.params.id as string);

const item = ref<ItemOut | null>(null);
const loading = ref(true);
const children = ref<ItemSummary[]>([]);

async function fetchItem() {
  loading.value = true;
  try {
    const resp = await api.items.get(itemId.value);
    if (resp.data) {
      item.value = resp.data;
    } else {
      toast.error(`API: status ${resp.status}, no data`);
    }
  } catch (e) {
    toast.error(`fetchItem error: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    loading.value = false;
  }
}

async function fetchChildren() {
  try {
    const resp = await api.items.getAll({ parentIds: [itemId.value] });
    children.value = resp.data?.items ?? [];
  } catch {
    children.value = [];
  }
}

async function handleChildQuantityUpdate(id: string, quantity: number) {
  await api.items.patch(id, { id, quantity });
  fetchChildren();
}

onMounted(() => {
  fetchItem();
  fetchChildren();
});

// Warranty color
const warrantyStatus = computed(() => {
  if (!item.value) return null;
  if (item.value.lifetimeWarranty) return "lifetime";
  if (!item.value.warrantyExpires) return null;
  const expires = new Date(item.value.warrantyExpires);
  if (expires.getFullYear() <= 1) return null;
  const now = new Date();
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  if (expires < now) return "expired";
  if (expires < sixMonths) return "expiring";
  return "valid";
});

const warrantyColor = computed(() => {
  switch (warrantyStatus.value) {
    case "valid":
    case "lifetime":
      return "text-green-600 dark:text-green-400";
    case "expiring":
      return "text-amber-600 dark:text-amber-400";
    case "expired":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
});

// Primary photo
const primaryPhoto = computed(() => {
  if (!item.value) return null;
  const photo = item.value.attachments?.find(a => a.primary && a.type === "photo");
  if (photo) return makeAttachmentUrl(item.value.id, photo.id);
  if (item.value.imageId) return makeAttachmentUrl(item.value.id, item.value.imageId);
  return null;
});

// Quick actions
async function duplicateItem() {
  if (!item.value) return;
  const resp = await api.items.duplicate(item.value.id);
  if (resp.data) {
    toast.success("Копия создана");
    router.push(`/items/${resp.data.id}`);
  }
}

async function toggleArchive() {
  if (!item.value) return;
  const target = !item.value.archived;
  const resp = await api.items.patch(item.value.id, {
    id: item.value.id,
    archived: target,
  });
  if (resp.data) {
    item.value = resp.data;
    toast.success(target ? "В архив" : "Возвращено из архива");
  } else {
    toast.error("Не удалось изменить статус архива");
  }
}

const showDeleteDialog = ref(false);

const showMoveScanner = ref(false);

const moveScannerPreload = computed<ItemSummary[]>(() => {
  if (!item.value) return [];
  const it = item.value;
  return [{
    id: it.id,
    name: it.name,
    assetId: it.assetId,
    description: it.description,
    quantity: it.quantity,
    insured: it.insured,
    archived: it.archived,
    createdAt: it.createdAt,
    updatedAt: it.updatedAt,
    purchasePrice: it.purchasePrice,
    soldTime: it.soldTime,
    tags: it.tags,
    imageId: it.imageId,
    thumbnailId: it.thumbnailId,
    location: it.location,
  }];
});

async function deleteItem() {
  if (!item.value) return;
  await api.items.delete(item.value.id);
  toast.success("Удалено");
  router.push("/items");
}

// Attachments display
type AttachmentView = {
  id: string;
  title: string;
  primary: boolean;
  isPhoto: boolean;
  url: string;
  thumbnailUrl: string | null;
};

const attachmentViews = computed<AttachmentView[]>(() => {
  if (!item.value?.attachments) return [];
  const itemIdLocal = item.value.id;
  return item.value.attachments.map(att => {
    const isPhoto = att.type === "photo";
    const url = makeAttachmentUrl(itemIdLocal, att.id);
    const thumbId = att.thumbnail?.id;
    const thumbnailUrl = isPhoto ? (thumbId ? makeAttachmentUrl(itemIdLocal, thumbId) : url) : null;
    return {
      id: att.id,
      title: att.title,
      primary: att.primary,
      isPhoto,
      url,
      thumbnailUrl,
    };
  });
});

const showAllAttachments = ref(false);
const visibleAttachmentViews = computed(() =>
  showAllAttachments.value ? attachmentViews.value : attachmentViews.value.slice(0, 4),
);

const showAttachmentsSheet = ref(false);

// === Inline Edit State ===
const editingSection = ref<string | null>(null);

// Create a deep copy for editing
const editForm = ref<Partial<ItemOut>>({});

function startEdit(section: string) {
  editingSection.value = section;
  editForm.value = JSON.parse(JSON.stringify(item.value));
}

function cancelEdit() {
  editingSection.value = null;
  editForm.value = {};
}

async function saveEdit() {
  if (!item.value || !editForm.value) return;

  try {
    const updateData = {
      ...item.value,
      name: editForm.value.name ?? item.value.name,
      description: editForm.value.description ?? item.value.description,
      locationId: editForm.value.location?.id ?? item.value.location?.id ?? "",
      quantity: editForm.value.quantity ?? item.value.quantity,
      tagIds: (editForm.value.tags ?? item.value.tags).map(t => t.id),
      manufacturer: editForm.value.manufacturer ?? item.value.manufacturer,
      modelNumber: editForm.value.modelNumber ?? item.value.modelNumber,
      serialNumber: editForm.value.serialNumber ?? item.value.serialNumber,
      notes: editForm.value.notes ?? item.value.notes,
      purchaseFrom: editForm.value.purchaseFrom ?? item.value.purchaseFrom,
      purchasePrice: editForm.value.purchasePrice ?? item.value.purchasePrice,
      purchaseTime: editForm.value.purchaseTime ?? item.value.purchaseTime,
      warrantyExpires: editForm.value.warrantyExpires ?? item.value.warrantyExpires,
      warrantyDetails: editForm.value.warrantyDetails ?? item.value.warrantyDetails,
      lifetimeWarranty: editForm.value.lifetimeWarranty ?? item.value.lifetimeWarranty,
      insured: editForm.value.insured ?? item.value.insured,
      fields: editForm.value.fields ?? item.value.fields,
      archived: item.value.archived,
      assetId: item.value.assetId,
      soldTime: item.value.soldTime,
      soldTo: item.value.soldTo,
      soldPrice: item.value.soldPrice,
      soldNotes: item.value.soldNotes,
      syncChildItemsLocations: item.value.syncChildItemsLocations,
    };

    const resp = await api.items.update(item.value.id, updateData);
    if (resp.data) {
      item.value = resp.data;
      toast.success("Сохранено");
    }
  } catch {
    toast.error("Ошибка сохранения");
  } finally {
    editingSection.value = null;
    editForm.value = {};
  }
}

// Location options for edit
const allLocations = ref<LocationOutCount[]>([]);
async function loadLocationsForEdit() {
  const resp = await api.locations.getAll();
  if (resp.data) allLocations.value = resp.data;
}

// Format date helper
function formatDate(date: Date | string | undefined): string {
  if (!date) return "\u2014";
  const d = date instanceof Date ? date : new Date(date);
  if (d.getFullYear() <= 1) return "\u2014";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
    <button
      class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      @click="router.back()"
    >
      <ArrowLeft class="w-4 h-4" />
      Назад
    </button>

    <div v-if="loading" class="space-y-4">
      <Skeleton class="h-48 w-full rounded-xl" />
      <Skeleton class="h-8 w-2/3 rounded" />
      <Skeleton class="h-32 w-full rounded-xl" />
    </div>

    <template v-else-if="item">
      <div v-if="primaryPhoto" class="rounded-xl overflow-hidden bg-muted/30 aspect-video">
        <img :src="primaryPhoto" :alt="item.name" class="w-full h-full object-contain" />
      </div>

      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-xl font-semibold">{{ item.name }}</h1>
          <span
            v-if="item.archived"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs"
          >
            <Archive class="w-3 h-3" />
            В архиве
          </span>
        </div>
        <p v-if="item.description" class="text-muted-foreground text-sm mt-1">{{ item.description }}</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-if="item.parent"
          :to="`/items/${item.parent.id}`"
          :title="`В: ${item.parent.name}`"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs hover:bg-accent hover:text-accent-foreground transition-colors max-w-[60vw]"
        >
          <Boxes class="w-3.5 h-3.5 shrink-0" />
          <span class="truncate">В: {{ item.parent.name }}</span>
        </NuxtLink>
        <div v-if="item.location" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs">
          <MapPin class="w-3.5 h-3.5" />
          {{ item.location.name }}
        </div>
        <div
          v-for="tag in item.tags"
          :key="tag.id"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs"
        >
          <Tag class="w-3.5 h-3.5" />
          {{ tag.name }}
        </div>
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs">
          Кол-во: {{ item.quantity }}
        </div>
      </div>

      <ItemDetailSection
        title="Детали"
        collapsible
        editable
        :editing="editingSection === 'details'"
        @edit="() => { startEdit('details'); loadLocationsForEdit(); }"
        @save="saveEdit"
        @cancel="cancelEdit"
      >
        <template v-if="editingSection === 'details'">
          <div class="space-y-3">
            <div>
              <label class="text-xs text-muted-foreground">Название</label>
              <input
                v-model="editForm.name"
                class="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label class="text-xs text-muted-foreground">Описание</label>
              <Textarea v-model="editForm.description" rows="2" />
            </div>
            <div>
              <label class="text-xs text-muted-foreground">Место</label>
              <select
                :value="editForm.location?.id"
                class="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                @change="editForm.location = { id: ($event.target as HTMLSelectElement).value, name: '', description: '', createdAt: '', updatedAt: '' }"
              >
                <option v-for="loc in allLocations" :key="loc.id" :value="loc.id">
                  {{ loc.name }}
                </option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-muted-foreground">Производитель</label>
                <input
                  v-model="editForm.manufacturer"
                  class="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label class="text-xs text-muted-foreground">Модель</label>
                <input
                  v-model="editForm.modelNumber"
                  class="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label class="text-xs text-muted-foreground">Серийный номер</label>
              <input
                v-model="editForm.serialNumber"
                class="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono text-xs"
              />
            </div>
            <div>
              <label class="text-xs text-muted-foreground">Количество</label>
              <QuantityStepper :quantity="editForm.quantity ?? 1" @update="editForm.quantity = $event" />
            </div>
          </div>
        </template>
        <template v-else>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div v-if="item.manufacturer">
              <dt class="text-muted-foreground text-xs">Производитель</dt>
              <dd>{{ item.manufacturer }}</dd>
            </div>
            <div v-if="item.modelNumber">
              <dt class="text-muted-foreground text-xs">Модель</dt>
              <dd>{{ item.modelNumber }}</dd>
            </div>
            <div v-if="item.serialNumber">
              <dt class="text-muted-foreground text-xs">Серийный номер</dt>
              <dd class="font-mono text-xs">{{ item.serialNumber }}</dd>
            </div>
            <div v-if="item.assetId && item.assetId !== '0'">
              <dt class="text-muted-foreground text-xs">Asset ID</dt>
              <dd class="font-mono text-xs">{{ item.assetId }}</dd>
            </div>
          </dl>
        </template>
      </ItemDetailSection>

      <ItemDetailSection title="Покупка" collapsible>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt class="text-muted-foreground text-xs">Цена</dt>
            <dd>{{ item.purchasePrice ? item.purchasePrice.toFixed(2) : '\u2014' }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">Дата покупки</dt>
            <dd>{{ formatDate(item.purchaseTime) }}</dd>
          </div>
          <div v-if="item.purchaseFrom">
            <dt class="text-muted-foreground text-xs">Куплено в</dt>
            <dd>{{ item.purchaseFrom }}</dd>
          </div>
        </dl>
      </ItemDetailSection>

      <ItemDetailSection v-if="warrantyStatus" title="Гарантия" collapsible>
        <div class="flex items-center gap-2 text-sm" :class="warrantyColor">
          <ShieldCheck v-if="warrantyStatus === 'valid' || warrantyStatus === 'lifetime'" class="w-5 h-5" />
          <ShieldAlert v-else-if="warrantyStatus === 'expiring'" class="w-5 h-5" />
          <Shield v-else class="w-5 h-5" />
          <span v-if="warrantyStatus === 'lifetime'">Пожизненная гарантия</span>
          <span v-else>до {{ formatDate(item.warrantyExpires) }}</span>
        </div>
        <p v-if="item.warrantyDetails" class="text-sm text-muted-foreground mt-2">{{ item.warrantyDetails }}</p>
      </ItemDetailSection>

      <ItemDetailSection
        title="Заметки"
        collapsible
        editable
        :editing="editingSection === 'notes'"
        @edit="startEdit('notes')"
        @save="saveEdit"
        @cancel="cancelEdit"
      >
        <template v-if="editingSection === 'notes'">
          <Textarea v-model="editForm.notes" rows="5" placeholder="Заметки..." />
        </template>
        <template v-else>
          <p v-if="item.notes" class="text-sm whitespace-pre-wrap">{{ item.notes }}</p>
          <p v-else class="text-sm text-muted-foreground">Нет заметок</p>
        </template>
      </ItemDetailSection>

      <ItemDetailSection v-if="item.attachments?.length" title="Файлы" collapsible>
        <template #header-actions>
          <button
            class="px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            @click="showAttachmentsSheet = true"
          >
            Управлять
          </button>
        </template>
        <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <a
            v-for="att in visibleAttachmentViews"
            :key="att.id"
            :href="att.url"
            target="_blank"
            rel="noopener"
            :title="att.title"
            class="relative aspect-square rounded-lg overflow-hidden bg-muted/30 border border-border hover:border-primary/50 transition-colors"
          >
            <img
              v-if="att.isPhoto && att.thumbnailUrl"
              :src="att.thumbnailUrl"
              :alt="att.title"
              class="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div v-else class="w-full h-full flex flex-col items-center justify-center p-2 gap-1">
              <Paperclip class="w-5 h-5 text-muted-foreground shrink-0" />
              <span class="text-[10px] text-muted-foreground truncate w-full text-center">{{ att.title }}</span>
            </div>
            <div
              v-if="att.primary"
              class="absolute top-1 right-1 p-0.5 bg-amber-500 rounded-full"
            >
              <Star class="w-3 h-3 text-white fill-white" />
            </div>
          </a>
        </div>
        <button
          v-if="attachmentViews.length > 4"
          class="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          @click="showAllAttachments = !showAllAttachments"
        >
          {{ showAllAttachments ? "Свернуть" : `Показать все (${attachmentViews.length})` }}
        </button>
      </ItemDetailSection>

      <ItemDetailSection v-else title="Файлы">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-muted-foreground">Файлов нет</span>
          <button
            class="px-3 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            @click="showAttachmentsSheet = true"
          >
            Загрузить
          </button>
        </div>
      </ItemDetailSection>

      <ItemDetailSection v-if="item.fields?.length" title="Поля" collapsible>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div v-for="field in item.fields" :key="field.id">
            <dt class="text-muted-foreground text-xs">{{ field.name }}</dt>
            <dd>
              <template v-if="field.type === 'boolean'">{{ field.booleanValue ? 'Да' : 'Нет' }}</template>
              <template v-else-if="field.type === 'number'">{{ field.numberValue }}</template>
              <template v-else>{{ field.textValue || '\u2014' }}</template>
            </dd>
          </div>
        </dl>
      </ItemDetailSection>

      <ItemDetailSection v-if="children.length" :title="`Содержимое (${children.length})`" collapsible>
        <div class="-mx-4 -my-4 bg-card rounded-xl overflow-hidden">
          <ItemListRow
            v-for="child in children"
            :key="child.id"
            :item="child"
            @quantity-update="handleChildQuantityUpdate"
          />
        </div>
      </ItemDetailSection>

      <!-- Maintenance -->
      <ItemMaintenanceSection :item-id="itemId" />

      <!-- Niimbot Print -->
      <NiimbotPrintSection type="item" :id="itemId" />

      <div class="flex gap-2 pt-2 flex-wrap">
        <Button variant="outline" class="flex-1 gap-2" @click="showMoveScanner = true">
          <ScanLine class="w-4 h-4" />
          Переместить
        </Button>
        <Button variant="outline" class="flex-1 gap-2" @click="duplicateItem">
          <Copy class="w-4 h-4" />
          Копировать
        </Button>
        <Button variant="outline" class="flex-1 gap-2" @click="toggleArchive">
          <component :is="item.archived ? ArchiveRestore : Archive" class="w-4 h-4" />
          {{ item.archived ? 'Вернуть' : 'Архив' }}
        </Button>
        <Button variant="outline" class="flex-1 gap-2 text-destructive hover:text-destructive" @click="showDeleteDialog = true">
          <Trash2 class="w-4 h-4" />
          Удалить
        </Button>
      </div>

      <AlertDialog v-model:open="showDeleteDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить «{{ item.name }}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Вещь будет удалена навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="deleteItem">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ItemAttachmentsSheet
        :open="showAttachmentsSheet"
        :item-id="item.id"
        :attachments="item.attachments ?? []"
        @update:open="showAttachmentsSheet = $event"
        @updated="(updated) => { item = updated; }"
        @deleted="(id) => {
          if (!item) return;
          item.attachments = item.attachments.filter(a => a.id !== id);
        }"
      />
    </template>

    <MoveScannerSheet
      :open="showMoveScanner"
      :preload-items="moveScannerPreload"
      :force-queue-mode="true"
      @update:open="showMoveScanner = $event"
      @done="fetchItem()"
    />
  </div>
</template>
