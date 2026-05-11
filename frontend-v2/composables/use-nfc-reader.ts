import { ref, type Ref } from "vue";
import type { ScanResult } from "./use-scanner";

export function extractUrlFromNdefRecords(records: ReadonlyArray<NDEFRecord>): string | null {
  const decoder = new TextDecoder();
  for (const record of records) {
    if (record.recordType !== "url" && record.recordType !== "absolute-url") continue;
    if (!record.data) continue;
    try {
      return decoder.decode(record.data);
    } catch {
      continue;
    }
  }
  return null;
}

export type NfcReaderError =
  | { kind: "permission_denied" }
  | { kind: "unsupported" }
  | { kind: "init_failed"; cause: string };

export interface UseNfcReader {
  isSupported: Ref<boolean>;
  isActive: Ref<boolean>;
  error: Ref<NfcReaderError | null>;
  start: () => Promise<void>;
  stop: () => void;
  onResult: (cb: (r: ScanResult) => void) => () => void;
}

export function useNfcReader(): UseNfcReader {
  const isSupported = ref(typeof window !== "undefined" && "NDEFReader" in window);
  const isActive = ref(false);
  const error = ref<NfcReaderError | null>(null);
  const listeners = new Set<(r: ScanResult) => void>();

  let controller: AbortController | null = null;
  let reader: NDEFReader | null = null;

  async function start(): Promise<void> {
    if (!isSupported.value) {
      error.value = { kind: "unsupported" };
      return;
    }
    if (isActive.value) return;
    error.value = null;
    controller = new AbortController();
    reader = new window.NDEFReader();
    reader.addEventListener("reading", (ev: NDEFReadingEvent) => {
      const url = extractUrlFromNdefRecords(ev.message.records);
      if (!url) return;
      const result: ScanResult = { text: url, format: "OTHER" };
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(50);
      }
      listeners.forEach(cb => cb(result));
    });
    reader.addEventListener("readingerror", () => {
      // eslint-disable-next-line no-console
      console.warn("[useNfcReader] readingerror");
    });
    try {
      await reader.scan({ signal: controller.signal });
      isActive.value = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        error.value = { kind: "permission_denied" };
        return;
      }
      error.value = { kind: "init_failed", cause: err instanceof Error ? err.message : String(err) };
    }
  }

  function stop(): void {
    controller?.abort();
    controller = null;
    reader = null;
    isActive.value = false;
  }

  function onResult(cb: (r: ScanResult) => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  return { isSupported, isActive, error, start, stop, onResult };
}
