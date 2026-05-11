import { ref, computed } from "vue";

// Lazy import to avoid SSR issues with Web Bluetooth
let niimbluelib: typeof import("@mmote/niimbluelib") | null = null;

async function loadNiimbluelib() {
  if (!niimbluelib) {
    niimbluelib = await import("@mmote/niimbluelib");
  }
  return niimbluelib;
}

export type TapeSize = {
  label: string;
  width: number;
  height: number;
};

export const PRESET_TAPE_SIZES: TapeSize[] = [
  { label: "30 × 20 mm", width: 30, height: 20 },
  { label: "40 × 30 mm", width: 40, height: 30 },
  { label: "50 × 30 mm", width: 50, height: 30 },
  { label: "50 × 50 mm", width: 50, height: 50 },
  { label: "40 × 60 mm", width: 40, height: 60 },
];

const DPMM = 8; // 203 DPI = 8 dots per mm
const MIN_TAPE_MM = 10;
const MAX_TAPE_WIDTH_MM = 100;
const MAX_TAPE_HEIGHT_MM = 200;

const LS_TAPE_KEY = "niimbot_tape_size";

// Shared state across component instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- niimbluelib alpha has no type declarations
const client = ref<any>(null);
const deviceName = ref<string | null>(null);
const connected = ref(false);
const printing = ref(false);
const printProgress = ref(0);

export function useNiimbot() {
  const isSupported = computed(() => typeof navigator !== "undefined" && "bluetooth" in navigator);

  function loadSavedTapeSize(): TapeSize {
    if (typeof localStorage === "undefined") return PRESET_TAPE_SIZES[2]; // 50x30 default
    const saved = localStorage.getItem(LS_TAPE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          Number.isFinite(parsed.width) &&
          Number.isFinite(parsed.height) &&
          parsed.width >= MIN_TAPE_MM &&
          parsed.width <= MAX_TAPE_WIDTH_MM &&
          parsed.height >= MIN_TAPE_MM &&
          parsed.height <= MAX_TAPE_HEIGHT_MM
        ) {
          return parsed;
        }
        localStorage.removeItem(LS_TAPE_KEY);
      } catch {
        localStorage.removeItem(LS_TAPE_KEY);
      }
    }
    return PRESET_TAPE_SIZES[2];
  }

  function saveTapeSize(size: TapeSize) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_TAPE_KEY, JSON.stringify(size));
    }
  }

  async function connect(): Promise<boolean> {
    const lib = await loadNiimbluelib();
    const newClient = new lib.NiimbotBluetoothClient();

    newClient.on("disconnect", () => {
      connected.value = false;
      deviceName.value = null;
      client.value = null;
    });

    newClient.on("printprogress", (event: { pagePrintProgress: number }) => {
      printProgress.value = event.pagePrintProgress;
    });

    try {
      const info = await newClient.connect();
      client.value = newClient;
      connected.value = true;
      deviceName.value = info.deviceName ?? "Niimbot";
      try {
        await newClient.fetchPrinterInfo();
      } catch {
        // connected but failed to fetch printer info — non-fatal
      }
      return true;
    } catch (e) {
      // User cancelled the Bluetooth picker — not an error
      if (e instanceof DOMException && e.name === "NotFoundError") {
        return false;
      }
      try {
        await newClient.disconnect();
      } catch {
        // cleanup disconnect failed — ignore
      }
      throw e;
    }
  }

  async function disconnect() {
    if (client.value) {
      try {
        await client.value.disconnect();
      } catch {
        // disconnect failed — clean up anyway
      } finally {
        client.value = null;
        connected.value = false;
        deviceName.value = null;
      }
    }
  }

  async function printImage(imageUrl: string, tapeSize: TapeSize, copies: number = 1): Promise<void> {
    if (!client.value) {
      await connect();
      if (!client.value) return; // user cancelled
    }

    const lib = await loadNiimbluelib();
    printing.value = true;
    printProgress.value = 0;

    // Capture client ref to avoid race condition if BLE disconnects mid-print
    const c = client.value;

    try {
      if (!Number.isFinite(tapeSize.width) || !Number.isFinite(tapeSize.height)) {
        throw new Error("Invalid tape dimensions");
      }

      const meta = c.getModelMetadata?.();
      const printheadPx = meta?.printheadPixels ?? 384;
      const labelWidthPx = Math.round(tapeSize.width * DPMM);
      const labelHeightPx = Math.round(tapeSize.height * DPMM);

      if (labelWidthPx <= 0 || labelHeightPx <= 0) {
        throw new Error("Tape dimensions must be greater than zero");
      }
      if (labelWidthPx > printheadPx) {
        throw new Error(`Tape width exceeds printhead (${printheadPx / DPMM} mm max)`);
      }

      // Load and process label image
      const img = await loadImage(imageUrl);
      const cropped = trimWhitespace(img);

      // Auto-rotate if orientation mismatch
      const imgIsLandscape = cropped.width > cropped.height;
      const tapeIsLandscape = labelWidthPx > labelHeightPx;
      const srcImg = imgIsLandscape !== tapeIsLandscape ? rotateImage90(cropped) : cropped;

      // Reserve a fixed-pixel margin inside the label area so the QR's quiet
      // zone is preserved regardless of source image size. trimWhitespace
      // crops the server PNG's built-in quiet zone, so without this margin
      // the QR data sits flush with the label edge — fine for ZXing on
      // /labelmaker (text+QR), bad for /qrcode (QR-only, source ~1200 px,
      // where source-side padding gets resized to invisibility).
      const labelMarginPx = 8;
      const contentW = Math.max(1, labelWidthPx - labelMarginPx * 2);
      const contentH = Math.max(1, labelHeightPx - labelMarginPx * 2);
      const labelCanvas = resizeToCanvas(srcImg, contentW, contentH);
      applyThreshold(labelCanvas, 128);

      // Center on printhead-wide canvas with the reserved margin
      const canvas = document.createElement("canvas");
      canvas.width = printheadPx;
      canvas.height = labelHeightPx;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to create canvas context");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const offsetX = Math.floor((printheadPx - contentW) / 2);
      ctx.drawImage(labelCanvas, offsetX, labelMarginPx);

      // Encode for printer
      const encoded = lib.ImageEncoder.encodeCanvas(canvas, "top");

      // Stop heartbeat during printing
      c.stopHeartbeat();

      const taskType = c.getPrintTaskType?.() ?? "B1";
      const quantity = Math.max(1, Math.floor(copies));
      const printTask = c.abstraction.newPrintTask(taskType, {
        totalPages: quantity,
        labelType: lib.LabelType.WithGaps,
        density: 5,
      });

      await printTask.printInit();
      for (let i = 0; i < quantity; i++) {
        await printTask.printPage(encoded, i + 1);
      }
      await withTimeout(printTask.waitForFinished(), 30000, "Print timeout — printer may need attention");

      printProgress.value = 100;
    } finally {
      try {
        await withTimeout(c.abstraction?.printEnd(), 5000, "printEnd timeout");
      } catch {
        // printEnd failed — printer may need power cycle
      }
      c.startHeartbeat?.();
      printing.value = false;
    }
  }

  return {
    isSupported,
    connected,
    deviceName,
    printing,
    printProgress,
    connect,
    disconnect,
    printImage,
    loadSavedTapeSize,
    saveTapeSize,
  };
}

// --- Helper functions ---

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function trimWhitespace(img: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const tmpCanvas = document.createElement("canvas");
  const w = img.width;
  const h = img.height;
  tmpCanvas.width = w;
  tmpCanvas.height = h;
  const ctx = tmpCanvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas context for trim");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const WHITE_THRESHOLD = 250;
  const isWhite = (i: number) => data[i] >= WHITE_THRESHOLD && data[i + 1] >= WHITE_THRESHOLD && data[i + 2] >= WHITE_THRESHOLD;

  let top = 0, bottom = h - 1, left = 0, right = w - 1;

  topScan: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isWhite((y * w + x) * 4)) { top = y; break topScan; }
    }
  }

  bottomScan: for (let y = h - 1; y >= top; y--) {
    for (let x = 0; x < w; x++) {
      if (!isWhite((y * w + x) * 4)) { bottom = y; break bottomScan; }
    }
  }

  leftScan: for (let x = 0; x < w; x++) {
    for (let y = top; y <= bottom; y++) {
      if (!isWhite((y * w + x) * 4)) { left = x; break leftScan; }
    }
  }

  rightScan: for (let x = w - 1; x >= left; x--) {
    for (let y = top; y <= bottom; y++) {
      if (!isWhite((y * w + x) * 4)) { right = x; break rightScan; }
    }
  }

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  if (cropW <= 0 || cropH <= 0) return tmpCanvas;

  const result = document.createElement("canvas");
  result.width = cropW;
  result.height = cropH;
  const rctx = result.getContext("2d");
  if (!rctx) throw new Error("Failed to create canvas context for crop");
  rctx.drawImage(tmpCanvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
  return result;
}

function rotateImage90(img: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.height;
  canvas.height = img.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas context for rotation");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas;
}

function resizeToCanvas(img: HTMLImageElement | HTMLCanvasElement, targetW: number, targetH: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas context");

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, targetW, targetH);

  const scale = Math.min(targetW / img.width, targetH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (targetW - w) / 2;
  const y = (targetH - h) / 2;
  ctx.drawImage(img, x, y, w, h);

  return canvas;
}

function applyThreshold(canvas: HTMLCanvasElement, threshold: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context for threshold");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const val = luminance < threshold ? 0 : 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}
