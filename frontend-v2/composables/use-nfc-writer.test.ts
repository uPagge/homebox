import { describe, expect, test } from "vitest";
import { buildTagUrl, mapNfcWriteError } from "./use-nfc-writer";

describe("buildTagUrl", () => {
  test("item target → /items/<id>", () => {
    expect(buildTagUrl({ kind: "item", id: "abc-123" }, "https://homebox.local"))
      .toBe("https://homebox.local/items/abc-123");
  });

  test("location target → /locations/<id>", () => {
    expect(buildTagUrl({ kind: "location", id: "xyz" }, "https://homebox.local"))
      .toBe("https://homebox.local/locations/xyz");
  });

  test("origin with trailing slash → no double slash", () => {
    expect(buildTagUrl({ kind: "item", id: "abc" }, "https://homebox.local/"))
      .toBe("https://homebox.local/items/abc");
  });

  test("uuid-like id is preserved verbatim", () => {
    expect(buildTagUrl({ kind: "item", id: "550e8400-e29b-41d4-a716-446655440000" }, "https://h.local"))
      .toBe("https://h.local/items/550e8400-e29b-41d4-a716-446655440000");
  });

  test("non-https origin (localhost dev) is preserved", () => {
    expect(buildTagUrl({ kind: "location", id: "abc" }, "http://localhost:3000"))
      .toBe("http://localhost:3000/locations/abc");
  });
});

describe("mapNfcWriteError", () => {
  function dom(name: string): DOMException {
    return new DOMException("test", name);
  }

  test("AbortError → cancelled", () => {
    expect(mapNfcWriteError(dom("AbortError"))).toEqual({ kind: "cancelled" });
  });

  test("NotAllowedError → permission_denied", () => {
    expect(mapNfcWriteError(dom("NotAllowedError"))).toEqual({ kind: "permission_denied" });
  });

  test("InvalidStateError → tag_locked", () => {
    expect(mapNfcWriteError(dom("InvalidStateError"))).toEqual({ kind: "tag_locked" });
  });

  test("NetworkError → tag_removed", () => {
    expect(mapNfcWriteError(dom("NetworkError"))).toEqual({ kind: "tag_removed" });
  });

  test("NotReadableError → read_error with name as cause", () => {
    expect(mapNfcWriteError(dom("NotReadableError"))).toEqual({
      kind: "read_error",
      cause: "NotReadableError",
    });
  });

  test("Error with message 'NFC write timeout' → timeout", () => {
    expect(mapNfcWriteError(new Error("NFC write timeout"))).toEqual({ kind: "timeout" });
  });

  test("Generic Error → read_error with message as cause", () => {
    expect(mapNfcWriteError(new Error("boom"))).toEqual({ kind: "read_error", cause: "boom" });
  });

  test("Non-Error value → read_error with String(value) cause", () => {
    expect(mapNfcWriteError("oops")).toEqual({ kind: "read_error", cause: "oops" });
  });
});
