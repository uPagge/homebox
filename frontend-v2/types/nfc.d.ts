// Web NFC API — minimal surface used by use-nfc-reader.ts and use-nfc-writer.ts.
// Spec: https://w3c.github.io/web-nfc/

interface NDEFRecord {
  readonly recordType: string;       // "url" | "absolute-url" | "text" | "mime" | ...
  readonly mediaType?: string;
  readonly id?: string;
  readonly data?: DataView;
  readonly encoding?: string;
  readonly lang?: string;
}

interface NDEFMessage {
  readonly records: ReadonlyArray<NDEFRecord>;
}

interface NDEFReadingEvent extends Event {
  readonly serialNumber: string;
  readonly message: NDEFMessage;
}

interface NDEFRecordInit {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: string | BufferSource;
  encoding?: string;
  lang?: string;
}

interface NDEFMessageInit {
  records: NDEFRecordInit[];
}

interface NDEFWriteOptions {
  overwrite?: boolean;
  signal?: AbortSignal;
}

interface NDEFScanOptions {
  signal?: AbortSignal;
}

declare class NDEFReader extends EventTarget {
  scan(options?: NDEFScanOptions): Promise<void>;
  write(message: NDEFMessageInit | string, options?: NDEFWriteOptions): Promise<void>;
  makeReadOnly(options?: { signal?: AbortSignal }): Promise<void>;
  addEventListener(
    type: "reading",
    listener: (event: NDEFReadingEvent) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: "readingerror",
    listener: (event: Event) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void;
}

interface Window {
  NDEFReader: typeof NDEFReader;
}
