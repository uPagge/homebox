const REAR_RX = /back|rear/i;
const NON_MAIN_RX = /telephoto|ultra|macro|depth/i;

export function pickCamera(
  devices: MediaDeviceInfo[],
  savedId: string | null,
): MediaDeviceInfo | null {
  if (devices.length === 0) return null;

  if (savedId) {
    const saved = devices.find(d => d.deviceId === savedId);
    if (saved) return saved;
  }

  const rear = devices.find(d => REAR_RX.test(d.label) && !NON_MAIN_RX.test(d.label));
  if (rear) return rear;

  return devices[0]!;
}
