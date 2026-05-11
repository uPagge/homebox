<script setup lang="ts">
import { Camera, Paperclip, Image, FileText, Receipt, Shield, Star } from "lucide-vue-next";
import type { ItemAttachment, ItemOut } from "~~/lib/api/types/data-contracts";
import { AttachmentTypes } from "~~/lib/api/types/non-generated";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  itemId: string;
  attachments: ItemAttachment[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  updated: [item: ItemOut];
  deleted: [attachmentId: string];
}>();

const api = useUserApi();
const { attachmentUrl: makeAttachmentUrl } = useAttachmentUrl();

const attachmentViews = computed(() =>
  props.attachments.map(att => ({
    ...att,
    thumbUrl:
      att.type === "photo" && att.thumbnail?.id
        ? makeAttachmentUrl(props.itemId, att.thumbnail.id)
        : null,
  })),
);

const photoInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

async function uploadFile(file: File, type: AttachmentTypes) {
  uploading.value = true;
  try {
    const resp = await api.items.attachments.add(props.itemId, file, file.name, type);
    if (resp.error || !resp.data) {
      toast.error(resp.status === 413 ? "Файл слишком большой" : "Не удалось загрузить файл");
      return;
    }
    emit("updated", resp.data);
    toast.success("Файл загружен");
  } catch {
    toast.error("Нет связи с сервером");
  } finally {
    uploading.value = false;
  }
}

async function onPhotoPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    await uploadFile(file, AttachmentTypes.Photo);
  } finally {
    input.value = "";
  }
}

const fileInput = ref<HTMLInputElement | null>(null);
const pendingFile = ref<{ file: File; type: AttachmentTypes } | null>(null);

function guessType(file: File): AttachmentTypes {
  return file.type.startsWith("image/") ? AttachmentTypes.Photo : AttachmentTypes.Attachment;
}

function onFilePick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  pendingFile.value = { file, type: guessType(file) };
  if (fileInput.value) fileInput.value.value = "";
}

async function confirmPendingUpload() {
  if (!pendingFile.value) return;
  const { file, type } = pendingFile.value;
  await uploadFile(file, type);
  pendingFile.value = null;
}

function cancelPendingUpload() {
  pendingFile.value = null;
}

const typeOptions: { value: AttachmentTypes; label: string }[] = [
  { value: AttachmentTypes.Photo, label: "Фото" },
  { value: AttachmentTypes.Manual, label: "Инструкция" },
  { value: AttachmentTypes.Warranty, label: "Гарантия" },
  { value: AttachmentTypes.Receipt, label: "Чек" },
  { value: AttachmentTypes.Attachment, label: "Файл" },
];

const expandedId = ref<string | null>(null);
const savingId = ref<string | null>(null);
const editForm = reactive({
  title: "",
  type: AttachmentTypes.Attachment as AttachmentTypes,
  primary: false,
});

async function toggleExpand(att: ItemAttachment) {
  if (expandedId.value === att.id) {
    expandedId.value = null;
    return;
  }
  expandedId.value = att.id;
  editForm.title = att.title;
  editForm.type = att.type as AttachmentTypes;
  editForm.primary = att.primary;
  await nextTick();
  document
    .querySelector(`[data-attachment-row="${att.id}"]`)
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

watch(() => editForm.type, (t) => {
  if (t !== AttachmentTypes.Photo) editForm.primary = false;
});

async function saveEdit(att: ItemAttachment) {
  if (!editForm.title.trim()) return;
  savingId.value = att.id;
  try {
    const resp = await api.items.attachments.update(props.itemId, att.id, {
      title: editForm.title,
      type: editForm.type,
      primary: editForm.type === AttachmentTypes.Photo && editForm.primary,
    });
    if (resp.error || !resp.data) {
      toast.error("Не удалось сохранить");
      return;
    }
    emit("updated", resp.data);
    expandedId.value = null;
    toast.success("Сохранено");
  } catch {
    toast.error("Нет связи с сервером");
  } finally {
    savingId.value = null;
  }
}

const deletingId = ref<string | null>(null);
const deleteConfirmFor = ref<ItemAttachment | null>(null);

async function confirmDelete() {
  const target = deleteConfirmFor.value;
  if (!target) return;
  deletingId.value = target.id;
  try {
    const resp = await api.items.attachments.delete(props.itemId, target.id);
    if (resp.error) {
      toast.error("Не удалось удалить");
      return;
    }
    emit("deleted", target.id);
    expandedId.value = null;
    toast.success("Удалено");
  } catch {
    toast.error("Нет связи с сервером");
  } finally {
    deletingId.value = null;
    deleteConfirmFor.value = null;
  }
}

function iconForType(type: string) {
  switch (type) {
    case AttachmentTypes.Photo: return Image;
    case AttachmentTypes.Manual: return FileText;
    case AttachmentTypes.Receipt: return Receipt;
    case AttachmentTypes.Warranty: return Shield;
    default: return Paperclip;
  }
}

function labelForType(type: string): string {
  switch (type) {
    case AttachmentTypes.Photo: return "Фото";
    case AttachmentTypes.Manual: return "Инструкция";
    case AttachmentTypes.Receipt: return "Чек";
    case AttachmentTypes.Warranty: return "Гарантия";
    default: return "Файл";
  }
}
</script>

<template>
  <Drawer
    :open="open"
    @update:open="(v: boolean) => {
      if (!v && (uploading || savingId !== null || deletingId !== null)) return;
      emit('update:open', v);
    }"
  >
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Файлы ({{ attachments.length }})</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <div class="flex gap-2">
          <button
            :disabled="uploading"
            class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm hover:bg-accent disabled:opacity-50 transition-colors"
            @click="photoInput?.click()"
          >
            <Camera class="w-4 h-4" />
            Фото
          </button>
          <button
            :disabled="uploading || pendingFile !== null"
            class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm hover:bg-accent disabled:opacity-50 transition-colors"
            @click="fileInput?.click()"
          >
            <Paperclip class="w-4 h-4" />
            Файл
          </button>
        </div>

        <input
          ref="photoInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="onPhotoPick"
        />
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          @change="onFilePick"
        />

        <div
          v-if="pendingFile"
          class="border border-primary/30 bg-primary/5 rounded-lg p-3 space-y-2"
        >
          <div class="flex items-center gap-2 text-sm">
            <Paperclip class="w-4 h-4 shrink-0 text-muted-foreground" />
            <span class="truncate flex-1">{{ pendingFile.file.name }}</span>
          </div>
          <div>
            <label class="text-xs text-muted-foreground">Тип</label>
            <Select v-model="pendingFile.type">
              <SelectTrigger class="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in typeOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex gap-2">
            <Button class="flex-1" :disabled="uploading" @click="confirmPendingUpload">
              {{ uploading ? "Загружаем..." : "Загрузить" }}
            </Button>
            <Button variant="outline" :disabled="uploading" @click="cancelPendingUpload">
              Отмена
            </Button>
          </div>
        </div>

        <ul v-if="attachments.length" class="border border-border rounded-lg overflow-hidden divide-y divide-border">
          <li :key="att.id" :data-attachment-row="att.id" class="bg-card" v-for="att in attachmentViews">
            <button
              class="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/40 transition-colors"
              @click="toggleExpand(att)"
            >
              <div class="w-10 h-10 shrink-0 rounded-md bg-muted/30 border border-border flex items-center justify-center overflow-hidden">
                <img
                  v-if="att.thumbUrl"
                  :src="att.thumbUrl"
                  :alt="att.title"
                  class="w-full h-full object-cover"
                />
                <component :is="iconForType(att.type)" v-else class="w-5 h-5 text-muted-foreground" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm truncate">{{ att.title }}</span>
                  <Star v-if="att.primary" class="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                </div>
                <span class="text-xs text-muted-foreground">{{ labelForType(att.type) }}</span>
              </div>
            </button>

            <div v-if="expandedId === att.id" class="px-3 pb-3 pt-3 space-y-3 border-t border-border">
              <div>
                <label class="text-xs text-muted-foreground">Название</label>
                <Input v-model="editForm.title" class="mt-1 h-9" />
              </div>
              <div>
                <label class="text-xs text-muted-foreground">Тип</label>
                <Select v-model="editForm.type">
                  <SelectTrigger class="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-xs">Главное фото</label>
                  <p
                    v-if="editForm.type !== AttachmentTypes.Photo"
                    class="text-[10px] text-muted-foreground"
                  >
                    доступно только для фото
                  </p>
                </div>
                <Switch
                  :model-value="editForm.primary"
                  :disabled="editForm.type !== AttachmentTypes.Photo"
                  @update:model-value="editForm.primary = $event"
                />
              </div>

              <div class="flex flex-wrap gap-2">
                <Button
                  class="flex-1 min-w-[7rem]"
                  :disabled="!editForm.title.trim() || savingId === att.id"
                  @click="saveEdit(att)"
                >
                  {{ savingId === att.id ? "Сохраняем..." : "Сохранить" }}
                </Button>
                <Button
                  variant="outline"
                  class="text-destructive hover:text-destructive"
                  :disabled="savingId === att.id || deletingId === att.id"
                  @click="deleteConfirmFor = att"
                >
                  Удалить
                </Button>
                <Button variant="outline" :disabled="savingId === att.id" @click="expandedId = null">
                  Отмена
                </Button>
              </div>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-muted-foreground text-center py-6">
          Файлов нет
        </p>
      </div>

      <AlertDialog
        :open="deleteConfirmFor !== null"
        @update:open="(v: boolean) => { if (!v) deleteConfirmFor = null; }"
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
            <AlertDialogDescription>
              «{{ deleteConfirmFor?.title }}» будет удалён без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="deletingId !== null">Отмена</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              :disabled="deletingId !== null"
              @click="confirmDelete"
            >
              {{ deletingId !== null ? "Удаляем..." : "Удалить" }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DrawerContent>
  </Drawer>
</template>
