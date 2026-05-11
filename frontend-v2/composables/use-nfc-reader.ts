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
