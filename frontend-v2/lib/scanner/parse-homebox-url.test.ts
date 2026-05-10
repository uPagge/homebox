import { describe, it, expect } from "vitest";
import { parseHomeboxUrl } from "./parse-homebox-url";

const UUID = "12345678-1234-1234-1234-123456789abc";

describe("parseHomeboxUrl", () => {
  describe("legacy paths (singular) → v2 paths (plural)", () => {
    it("rewrites /item/<uuid> to /items/<uuid>", () => {
      expect(parseHomeboxUrl(`https://homebox.home.local/item/${UUID}`)).toBe(`/items/${UUID}`);
    });

    it("rewrites /location/<uuid> to /locations/<uuid>", () => {
      expect(parseHomeboxUrl(`https://homebox.home.local/location/${UUID}`)).toBe(`/locations/${UUID}`);
    });

    it("rewrites /label/<uuid> to /labels/<uuid>", () => {
      expect(parseHomeboxUrl(`https://homebox.home.local/label/${UUID}`)).toBe(`/labels/${UUID}`);
    });

    it("rewrites /tag/<uuid> to /labels/<uuid> (v2 unifies tags into labels)", () => {
      expect(parseHomeboxUrl(`https://homebox.home.local/tag/${UUID}`)).toBe(`/labels/${UUID}`);
    });
  });

  describe("v2 paths (plural)", () => {
    it("passes /items/<uuid> through", () => {
      expect(parseHomeboxUrl(`https://v2.example.com/items/${UUID}`)).toBe(`/items/${UUID}`);
    });

    it("passes /locations/<uuid> through", () => {
      expect(parseHomeboxUrl(`https://v2.example.com/locations/${UUID}`)).toBe(`/locations/${UUID}`);
    });

    it("passes /labels/<uuid> through", () => {
      expect(parseHomeboxUrl(`https://v2.example.com/labels/${UUID}`)).toBe(`/labels/${UUID}`);
    });
  });

  describe("origin-agnostic behavior", () => {
    it("ignores host entirely — only the path matters", () => {
      expect(parseHomeboxUrl(`https://attacker.com/items/${UUID}`)).toBe(`/items/${UUID}`);
    });

    it("works with arbitrary subdomain / port", () => {
      expect(parseHomeboxUrl(`http://192.168.0.99:7745/items/${UUID}`)).toBe(`/items/${UUID}`);
    });
  });

  describe("path variants", () => {
    it("strips trailing path segments after the uuid (e.g. /edit)", () => {
      expect(parseHomeboxUrl(`https://h.local/item/${UUID}/edit`)).toBe(`/items/${UUID}`);
    });

    it("strips trailing slash after the uuid", () => {
      expect(parseHomeboxUrl(`https://h.local/item/${UUID}/`)).toBe(`/items/${UUID}`);
    });

    it("matches case-insensitively on the segment", () => {
      expect(parseHomeboxUrl(`https://h.local/Items/${UUID}`)).toBe(`/items/${UUID}`);
    });
  });

  describe("rejected inputs", () => {
    it("returns null for non-URL text", () => {
      expect(parseHomeboxUrl("just some text")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseHomeboxUrl("")).toBeNull();
    });

    it("returns null for URL with unrecognized entity segment", () => {
      expect(parseHomeboxUrl(`https://h.local/profile/${UUID}`)).toBeNull();
    });

    it("returns null for URL with no entity segment", () => {
      expect(parseHomeboxUrl("https://h.local/")).toBeNull();
    });

    it("returns null for URL with malformed uuid (too short)", () => {
      expect(parseHomeboxUrl("https://h.local/item/12345678-1234-1234-1234-12345678")).toBeNull();
    });

    it("returns null for URL with no uuid after segment", () => {
      expect(parseHomeboxUrl("https://h.local/items")).toBeNull();
    });

    it("returns null for asset paths (v2 has no /assets page)", () => {
      expect(parseHomeboxUrl(`https://h.local/assets/${UUID}`)).toBeNull();
      expect(parseHomeboxUrl(`https://h.local/a/${UUID}`)).toBeNull();
    });
  });
});
