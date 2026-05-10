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

/** Formats the consumer is allowed to whitelist. */
export type ScannableFormat =
  | "QR_CODE"
  | "EAN_13"
  | "EAN_8"
  | "UPC_A"
  | "UPC_E"
  | "CODE_128";

/** Format reported in a result; can be `OTHER` if ZXing matched something outside the whitelist. */
export type DetectedFormat = ScannableFormat | "OTHER";

export type ScanResult = { text: string; format: DetectedFormat };

export type ScannerError =
  | { kind: "permission_denied" }
  | { kind: "no_devices" }
  | { kind: "unsupported" }
  | { kind: "init_failed"; cause: string };

export interface UseScannerOptions {
  /** ZXing format whitelist. Non-empty tuple — at least one format required. */
  formats: readonly [ScannableFormat, ...ScannableFormat[]];
  /** Suppress identical scans within this window (ms). Default `0` — every decode emits. */
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

const FORMAT_TO_ZXING: Record<ScannableFormat, BarcodeFormat> = {
  QR_CODE: BarcodeFormat.QR_CODE,
  EAN_13: BarcodeFormat.EAN_13,
  EAN_8: BarcodeFormat.EAN_8,
  UPC_A: BarcodeFormat.UPC_A,
  UPC_E: BarcodeFormat.UPC_E,
  CODE_128: BarcodeFormat.CODE_128,
};

function zxingToScanFormat(fmt: BarcodeFormat): DetectedFormat {
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

  // Generation counter — incremented by stop() and at the top of start()/selectDevice().
  // Each async method captures its generation and bails after every await if superseded,
  // preventing close-during-start races that would leak the camera (LED stays on).
  let runId = 0;

  const debounceMs = opts.duplicateDebounceMs ?? 0;

  function buildReader(): BrowserMultiFormatReader {
    const hints = new Map();
    const zxingFormats = opts.formats.map(f => FORMAT_TO_ZXING[f]);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, zxingFormats);
    return new BrowserMultiFormatReader(hints);
  }

  function getActiveStream(): MediaStream | null {
    if (!videoElRef) return null;
    const obj = videoElRef.srcObject;
    return obj instanceof MediaStream ? obj : null;
  }

  function stopTracksSafely(stream: MediaStream): void {
    for (const t of stream.getTracks()) {
      try {
        t.stop();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[useScanner] track.stop failed:", e);
      }
    }
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
      // Single-shot consumers ignore until reset(); push-style consumers (onResult) still receive.
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
    // ZXing acquires the track asynchronously; defer to the next tick so
    // getCapabilities() sees a live track when probing torch support.
    setTimeout(probeTorch, 100);
  }

  async function start(videoEl: HTMLVideoElement): Promise<void> {
    if (isActive.value) stop();
    const myRun = ++runId;

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
      stopTracksSafely(stream);
    } catch (err) {
      if (myRun !== runId) return;
      if (err instanceof Error && err.name === "NotAllowedError") {
        error.value = { kind: "permission_denied" };
        return;
      }
      error.value = { kind: "init_failed", cause: err instanceof Error ? err.message : String(err) };
      return;
    }
    if (myRun !== runId) return;

    let allDevices: MediaDeviceInfo[];
    try {
      allDevices = (await navigator.mediaDevices.enumerateDevices())
        .filter(d => d.kind === "videoinput");
    } catch (err) {
      if (myRun !== runId) return;
      error.value = { kind: "init_failed", cause: err instanceof Error ? err.message : String(err) };
      return;
    }
    if (myRun !== runId) return;

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
      if (myRun !== runId) {
        // Superseded after ZXing acquired the stream — release it before bailing.
        stop();
        return;
      }
      isActive.value = true;
    } catch (err) {
      const wasSuperseded = myRun !== runId;
      stop();
      if (wasSuperseded) return;
      error.value = { kind: "init_failed", cause: err instanceof Error ? err.message : String(err) };
    }
  }

  function stop(): void {
    runId++;
    if (reader) {
      try {
        reader.reset();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[useScanner] reader.reset failed:", e);
      }
      reader = null;
    }
    const stream = getActiveStream();
    if (stream) {
      stopTracksSafely(stream);
    }
    if (videoElRef) {
      try {
        videoElRef.srcObject = null;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[useScanner] clear srcObject failed:", e);
      }
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
    const myRun = ++runId;

    if (reader) {
      try {
        reader.reset();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[useScanner] reader.reset failed:", e);
      }
    }
    const stream = getActiveStream();
    if (stream) stopTracksSafely(stream);

    selectedDeviceId.value = deviceId;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, deviceId);
    }

    if (!reader) reader = buildReader();
    torchOn.value = false;
    try {
      await startDecodeLoop(deviceId);
      if (myRun !== runId) {
        stop();
        return;
      }
    } catch (err) {
      const wasSuperseded = myRun !== runId;
      stop();
      if (wasSuperseded) return;
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
