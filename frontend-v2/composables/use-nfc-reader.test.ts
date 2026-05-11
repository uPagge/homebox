import { describe, expect, test } from "vitest";
import { extractUrlFromNdefRecords } from "./use-nfc-reader";

function rec(recordType: string, text: string): NDEFRecord {
  const data = new TextEncoder().encode(text);
  return {
    recordType,
    data: new DataView(data.buffer, data.byteOffset, data.byteLength),
  } as NDEFRecord;
}

describe("extractUrlFromNdefRecords", () => {
  test("single URL record → returns its URL", () => {
    const records = [rec("url", "https://homebox.local/items/abc-123")];
    expect(extractUrlFromNdefRecords(records)).toBe("https://homebox.local/items/abc-123");
  });

  test("absolute-url record → returns its URL", () => {
    const records = [rec("absolute-url", "https://homebox.local/locations/xyz")];
    expect(extractUrlFromNdefRecords(records)).toBe("https://homebox.local/locations/xyz");
  });

  test("text record → returns null (text records ignored)", () => {
    const records = [rec("text", "not a url")];
    expect(extractUrlFromNdefRecords(records)).toBeNull();
  });

  test("empty records → returns null", () => {
    expect(extractUrlFromNdefRecords([])).toBeNull();
  });

  test("mixed records: first URL wins", () => {
    const records = [
      rec("text", "hello"),
      rec("url", "https://homebox.local/items/aaa"),
      rec("url", "https://homebox.local/items/bbb"),
    ];
    expect(extractUrlFromNdefRecords(records)).toBe("https://homebox.local/items/aaa");
  });

  test("record without data → skipped", () => {
    const records = [
      { recordType: "url" } as NDEFRecord,
      rec("url", "https://homebox.local/items/abc"),
    ];
    expect(extractUrlFromNdefRecords(records)).toBe("https://homebox.local/items/abc");
  });
});
