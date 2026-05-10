import { describe, it, expect } from "vitest";
import { pickCamera } from "./pick-camera";

function dev(deviceId: string, label: string): MediaDeviceInfo {
  return { deviceId, label, kind: "videoinput", groupId: "" } as MediaDeviceInfo;
}

describe("pickCamera", () => {
  it("returns null when device list is empty", () => {
    expect(pickCamera([], null)).toBeNull();
    expect(pickCamera([], "saved")).toBeNull();
  });

  it("returns the saved device when its id is in the list", () => {
    const a = dev("a", "Front Camera");
    const b = dev("b", "Back Telephoto Camera");
    expect(pickCamera([a, b], "b")).toBe(b);
  });

  it("ignores saved id when it is not in the list and falls back to heuristic", () => {
    const a = dev("a", "Back Camera");
    const b = dev("b", "Front Camera");
    expect(pickCamera([a, b], "missing")).toBe(a);
  });

  it("prefers a back/rear-labeled device over a front device", () => {
    const front = dev("f", "FaceTime HD Camera");
    const back = dev("b", "Back Camera");
    expect(pickCamera([front, back], null)).toBe(back);
  });

  it("rejects telephoto / ultra / macro / depth back cameras and picks the plain back wide", () => {
    const tele = dev("1", "Back Telephoto Camera");
    const ultra = dev("2", "Back Ultra Wide Camera");
    const macro = dev("3", "Back Macro Camera");
    const depth = dev("4", "Back Depth Camera");
    const wide = dev("5", "Back Camera");
    expect(pickCamera([tele, ultra, macro, depth, wide], null)).toBe(wide);
  });

  it("falls back to the first device when no label matches", () => {
    const a = dev("a", "");
    const b = dev("b", "");
    expect(pickCamera([a, b], null)).toBe(a);
  });

  it("matches case-insensitively (REAR / Rear / rear all work)", () => {
    const a = dev("a", "REAR camera");
    expect(pickCamera([a], null)).toBe(a);
  });

  it("respects user choice even when saved device is a non-main lens", () => {
    const tele = dev("t", "Back Telephoto Camera");
    const wide = dev("w", "Back Camera");
    expect(pickCamera([tele, wide], "t")).toBe(tele);
  });
});
