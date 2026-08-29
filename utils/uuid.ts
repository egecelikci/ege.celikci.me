/**
 * RFC 9562 UUID v7 (time-ordered) generation.
 * @see https://www.rfc-editor.org/info/rfc9562/#section-5.7
 */
export function uuidv7(timestamp: number = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ms = timestamp;

  // unix_ts_ms: 48 bits, big-endian, bytes[0..5]
  const tsHigh = Math.floor(ms / 0x10000); // top 32 bits
  const tsLow = ms % 0x10000; // bottom 16 bits

  bytes[0] = (tsHigh >>> 24) & 0xff;
  bytes[1] = (tsHigh >>> 16) & 0xff;
  bytes[2] = (tsHigh >>> 8) & 0xff;
  bytes[3] = tsHigh & 0xff;
  bytes[4] = (tsLow >>> 8) & 0xff;
  bytes[5] = tsLow & 0xff;

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7, preserve random rand_a nibble
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20)}`;
}
