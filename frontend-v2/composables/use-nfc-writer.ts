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
