import { describe, expect, test } from "vitest";
import { buildTagUrl } from "./use-nfc-writer";

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
