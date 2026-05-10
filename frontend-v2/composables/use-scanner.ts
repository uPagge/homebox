import { ref, type Ref } from "vue";
import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
  NotFoundException,
  type Result,
} from "@zxing/library";
import { toast } from "vue-sonner";
import { pickCamera } from "~/lib/scanner/pick-camera";

const STORAGE_KEY = "homebox-v2/scanner-camera-id";

export type ScanFormat =
  | "QR_CODE"
  | "EAN_13"
  | "EAN_8"
  | "UPC_A"
  | "UPC_E"
  | "CODE_128"
  | "OTHER";

export type ScanResult = { text: string; format: ScanFormat };

export type ScannerError =
  | { kind: "permission_denied" }
  | { kind: "no_devices" }
  | { kind: "unsupported" }
  | { kind: "init_failed"; cause: string };

export interface UseScannerOptions {
  /** ZXing format whitelist. */
  formats: ScanFormat[];
  /** Debounce identical scans within this window (ms). 0 disables. */
  duplicateDebounceMs?: number;
}

export interface UseScanner {
  isActive: Ref<boolean>;
  devices: Ref<MediaDeviceInfo[]>;
  selectedDeviceId: Ref<string | null>;
  hasTorch: Ref<boolean>;
  torchOn: Ref<boolean>;
  result: Ref<ScanResult | null>;
  error: Ref<ScannerError | null>;
  start: (videoEl: HTMLVideoElement) => Promise<void>;
  stop: () => void;
  selectDevice: (deviceId: string) => Promise<void>;
  toggleTorch: () => Promise<void>;
  reset: () => void;
  onResult: (cb: (r: ScanResult) => void) => () => void;
}

const FORMAT_TO_ZXING: Record<Exclude<ScanFormat, "OTHER">, BarcodeFormat> = {
  QR_CODE: BarcodeFormat.QR_CODE,
  EAN_13: BarcodeFormat.EAN_13,
  EAN_8: BarcodeFormat.EAN_8,
  UPC_A: BarcodeFormat.UPC_A,
  UPC_E: BarcodeFormat.UPC_E,
  CODE_128: BarcodeFormat.CODE_128,
};

function zxingToScanFormat(fmt: BarcodeFormat): ScanFormat {
  switch (fmt) {
    case BarcodeFormat.QR_CODE: return "QR_CODE";
    case BarcodeFormat.EAN_13: return "EAN_13";
    case BarcodeFormat.EAN_8: return "EAN_8";
    case BarcodeFormat.UPC_A: return "UPC_A";
    case BarcodeFormat.UPC_E: return "UPC_E";
    case BarcodeFormat.CODE_128: return "CODE_128";
    default: return "OTHER";
  }
}

export function useScanner(opts: UseScannerOptions): UseScanner {
  const isActive = ref(false);
  const devices = ref<MediaDeviceInfo[]>([]);
  const selectedDeviceId = ref<string | null>(null);
  const hasTorch = ref(false);
  const torchOn = ref(false);
  const result = ref<ScanResult | null>(null);
  const error = ref<ScannerError | null>(null);

  let reader: BrowserMultiFormatReader | null = null;
  let videoElRef: HTMLVideoElement | null = null;
  let lastScan: { text: string; ts: number } | null = null;
  const listeners = new Set<(r: ScanResult) => void>();

  const debounceMs = opts.duplicateDebounceMs ?? 0;

  function buildReader(): BrowserMultiFormatReader {
    const hints = new Map();
    const zxingFormats = opts.formats
      .filter((f): f is Exclude<ScanFormat, "OTHER"> => f !== "OTHER")
      .map(f => FORMAT_TO_ZXING[f]);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, zxingFormats);
    return new BrowserMultiFormatReader(hints);
  }

  function getActiveStream(): MediaStream | null {
    if (!videoElRef) return null;
    const obj = videoElRef.srcObject;
    return obj instanceof MediaStream ? obj : null;
  }

  function probeTorch(): void {
    const stream = getActiveStream();
    if (!stream) {
      hasTorch.value = false;
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) {
      hasTorch.value = false;
      return;
    }
    const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    hasTorch.value = caps.torch === true;
  }

  function handleResult(r: Result | null): void {
    if (!r) return;

    const text = r.getText();
    const now = Date.now();
    if (debounceMs > 0 && lastScan && lastScan.text === text && now - lastScan.ts < debounceMs) {
      return;
    }
    lastScan = { text, ts: now };

    const fmt = zxingToScanFormat(r.getBarcodeFormat());
    const out: ScanResult = { text, format: fmt };

    if (result.value !== null) {
      // Notify push-style listeners; single-shot consumers ignore until reset().
      listeners.forEach(cb => cb(out));
      return;
    }

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(50);
    }
    result.value = out;
    listeners.forEach(cb => cb(out));
  }

  async function startDecodeLoop(deviceId: string): Promise<void> {
    if (!reader || !videoElRef) return;
    await reader.decodeFromVideoDevice(deviceId, videoElRef, (res, err) => {
      if (res) {
        handleResult(res);
      }
      if (err && !(err instanceof NotFoundException)) {
        // eslint-disable-next-line no-console
        console.warn("[useScanner] decode error:", err);
      }
    });
    // Wait one tick for srcObject to settle, then probe torch capability.
    setTimeout(probeTorch, 100);
  }

  async function start(videoEl: HTMLVideoElement): Promise<void> {
    error.value = null;
    result.value = null;
    videoElRef = videoEl;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      error.value = { kind: "unsupported" };
      return;
    }

    // Pre-flight permission request.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        error.value = { kind: "permission_denied" };
        return;
      }
      error.value = { kind: "init_failed", cause: err instanceof Error ? err.message : String(err) };
      return;
    }

    let allDevices: MediaDeviceInfo[];
    try {
      allDevices = (await navigator.mediaDevices.enumerateDevices())
        .filter(d => d.kind === "videoinput");
    } catch (err) {
      error.value = { kind: "init_failed", cause: err instanceof Error ? err.message : String(err) };
      return;
    }

    if (allDevices.length === 0) {
      error.value = { kind: "no_devices" };
      return;
    }

    devices.value = allDevices;
    const savedId = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const picked = pickCamera(allDevices, savedId);
    if (!picked) {
      error.value = { kind: "no_devices" };
      return;
    }
    selectedDeviceId.value = picked.deviceId;

    reader = buildReader();
    try {
      await startDecodeLoop(picked.deviceId);
      isActive.value = true;
    } catch (err) {
      error.value = { kind: "init_failed", cause: err instanceof Error ? err.message : String(err) };
    }
  }

  function stop(): void {
    if (reader) {
      reader.reset();
      reader = null;
    }
    const stream = getActiveStream();
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    if (videoElRef) {
      videoElRef.srcObject = null;
    }
    videoElRef = null;
    torchOn.value = false;
    hasTorch.value = false;
    result.value = null;
    error.value = null;
    isActive.value = false;
    lastScan = null;
  }

  async function selectDevice(deviceId: string): Promise<void> {
    if (!videoElRef) return;
    if (reader) reader.reset();
    const stream = getActiveStream();
    if (stream) stream.getTracks().forEach(t => t.stop());

    selectedDeviceId.value = deviceId;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, deviceId);
    }

    if (!reader) reader = buildReader();
    torchOn.value = false;
    try {
      await startDecodeLoop(deviceId);
    } catch (err) {
      error.value = { kind: "init_failed", cause: err instanceof Error ? err.message : String(err) };
    }
  }

  async function toggleTorch(): Promise<void> {
    const stream = getActiveStream();
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn.value;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      torchOn.value = next;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[useScanner] torch toggle failed:", err);
      toast.error("Не удалось управлять фонариком");
    }
  }

  function reset(): void {
    result.value = null;
    error.value = null;
    lastScan = null;
  }

  function onResult(cb: (r: ScanResult) => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  return {
    isActive,
    devices,
    selectedDeviceId,
    hasTorch,
    torchOn,
    result,
    error,
    start,
    stop,
    selectDevice,
    toggleTorch,
    reset,
    onResult,
  };
}
