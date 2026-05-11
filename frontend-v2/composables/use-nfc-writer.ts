import { ref, type Ref } from "vue";
import type { HomeboxTarget } from "~/lib/scanner/parse-homebox-url";

export function buildTagUrl(target: HomeboxTarget, origin: string): string {
  const trimmed = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const segment = target.kind === "item" ? "items" : "locations";
  return `${trimmed}/${segment}/${target.id}`;
}

export type NfcWriterError =
  | { kind: "cancelled" }
  | { kind: "permission_denied" }
  | { kind: "tag_locked" }
  | { kind: "tag_removed" }
  | { kind: "timeout" }
  | { kind: "read_error"; cause: string };

const TIMEOUT_MARKER = "NFC write timeout";

export function mapNfcWriteError(err: unknown): NfcWriterError {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "AbortError": return { kind: "cancelled" };
      case "NotAllowedError": return { kind: "permission_denied" };
      case "InvalidStateError": return { kind: "tag_locked" };
      case "NetworkError": return { kind: "tag_removed" };
      default: return { kind: "read_error", cause: err.name };
    }
  }
  if (err instanceof Error) {
    if (err.message === TIMEOUT_MARKER) return { kind: "timeout" };
    return { kind: "read_error", cause: err.message };
  }
  return { kind: "read_error", cause: String(err) };
}

export interface UseNfcWriter {
  isSupported: Ref<boolean>;
  isWriting: Ref<boolean>;
  write: (target: HomeboxTarget) => Promise<void>;
  cancel: () => void;
}

const WRITE_TIMEOUT_MS = 30_000;

export function useNfcWriter(): UseNfcWriter {
  const isSupported = ref(typeof window !== "undefined" && "NDEFReader" in window);
  const isWriting = ref(false);
  let controller: AbortController | null = null;

  async function write(target: HomeboxTarget): Promise<void> {
    if (!isSupported.value) throw new DOMException("Web NFC not supported", "NotSupportedError");
    if (isWriting.value) throw new DOMException("Write already in progress", "InvalidStateError");

    const url = buildTagUrl(target, window.location.origin);
    controller = new AbortController();
    isWriting.value = true;

    try {
      const reader = new window.NDEFReader();
      const writePromise = reader.write(
        { records: [{ recordType: "url", data: url }] },
        { signal: controller.signal },
      );
      await withWriteTimeout(writePromise, WRITE_TIMEOUT_MS);
    } finally {
      // Release NFC radio: noop on success, cancels in-flight write on timeout/error.
      controller?.abort();
      isWriting.value = false;
      controller = null;
    }
  }

  function cancel(): void {
    controller?.abort();
  }

  return { isSupported, isWriting, write, cancel };
}

function withWriteTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(TIMEOUT_MARKER)), ms)),
  ]);
}
