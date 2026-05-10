<script setup lang="ts">
import { Package, MapPin, Tag, ScanLine } from "lucide-vue-next";
import { useDialog, DialogID } from "@/components/ui/dialog-provider/utils";

type CreateType = "item" | "location" | "label" | null;
const showCreateMenu = ref(false);
const showQuickMenu = ref(false);
const activeCreate = ref<CreateType>(null);
const initialBarcode = ref<string>("");
const route = useRoute();

// Detect current location context from URL
const contextLocationId = computed(() => {
  // On /locations/[id] — use that location
  if (route.path.match(/^\/locations\/[^/]+$/)) {
    return route.params.id as string;
  }
  return undefined;
});

function openCreateMenu() {
  showCreateMenu.value = true;
}

function selectCreate(type: CreateType) {
  showCreateMenu.value = false;
  activeCreate.value = type;
}

function onCreated() {
  activeCreate.value = null;
}

function onLocationCreated(id: string) {
  activeCreate.value = null;
  navigateTo(`/locations/${id}`);
}

function closeCreate(open: boolean) {
  if (!open) {
    activeCreate.value = null;
    initialBarcode.value = "";
  }
}

function onScannedBarcode(text: string): void {
  initialBarcode.value = text;
  activeCreate.value = "item";
}

const { activeDialog, openDialog } = useDialog();

watch(activeDialog, (id) => {
  showQuickMenu.value = id === DialogID.QuickMenu;
});

function onQuickMenuCreate(type: "item" | "location" | "label") {
  activeCreate.value = type as CreateType;
}
</script>

<template>
  <div class="flex min-h-screen">
    <AppSidebar @create="openCreateMenu">
      <template #search>
        <SearchBar />
      </template>
    </AppSidebar>

    <main class="flex-1 min-w-0">
      <header class="md:hidden sticky top-0 z-40 bg-card border-b border-border px-4 py-2.5">
        <div class="flex items-center gap-3">
          <SearchBar class="flex-1" />
          <button
            class="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Сканировать"
            @click="openDialog(DialogID.Scanner)"
          >
            <ScanLine class="w-5 h-5" />
          </button>
          <div class="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-sm">
            &#x1F464;
          </div>
        </div>
      </header>

      <div class="pb-20 md:pb-0">
        <slot />
      </div>
    </main>

    <BottomTabs @add="openCreateMenu" />

    <!-- Create menu drawer -->
    <Drawer :open="showCreateMenu" @update:open="showCreateMenu = $event">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Создать</DrawerTitle>
        </DrawerHeader>
        <div class="px-4 pb-6 space-y-2">
          <button
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors text-left"
            @click="selectCreate('item')"
          >
            <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Package class="w-5 h-5 text-primary" />
            </div>
            <div>
              <div class="text-sm font-medium">Вещь</div>
              <div class="text-xs text-muted-foreground">Добавить предмет в инвентарь</div>
            </div>
          </button>
          <button
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors text-left"
            @click="selectCreate('location')"
          >
            <div class="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <MapPin class="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div class="text-sm font-medium">Локация</div>
              <div class="text-xs text-muted-foreground">Место хранения</div>
            </div>
          </button>
          <button
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors text-left"
            @click="selectCreate('label')"
          >
            <div class="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
              <Tag class="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <div class="text-sm font-medium">Тег</div>
              <div class="text-xs text-muted-foreground">Метка для группировки</div>
            </div>
          </button>
        </div>
      </DrawerContent>
    </Drawer>

    <!-- Create sheets -->
    <QuickAddSheet
      :open="activeCreate === 'item'"
      :context-location-id="contextLocationId"
      :initial-barcode="initialBarcode"
      @update:open="closeCreate"
      @created="onCreated"
    />
    <LocationCreateSheet
      :open="activeCreate === 'location'"
      :parent-id="contextLocationId"
      @update:open="closeCreate"
      @created="onLocationCreated"
    />
    <LabelCreateSheet
      :open="activeCreate === 'label'"
      @update:open="closeCreate"
      @created="onCreated"
    />
    <QuickMenuDialog
      :open="showQuickMenu"
      @update:open="showQuickMenu = $event"
      @create="onQuickMenuCreate"
    />

    <ScannerDialog @scanned-barcode="onScannedBarcode" />
  </div>
</template>
