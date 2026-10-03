import Cache, { type Options } from "lume/core/cache.ts";
import { posix } from "node:path";

/**
 * Lume's cache keyed by SHA-256 instead of MD5.
 *
 * Deno has no native MD5, so `@std/crypto` falls back to WASM at roughly 400 MB/s. Image transforms use whole files as cache keys, which makes hashing the largest single cost of a build. SHA-256 is native (~2 GB/s) and a cache key only needs to be unique.
 */
export default class FastCache extends Cache {
  #folder: string;

  constructor(options: Options) {
    super(options);
    this.#folder = options.folder;
  }

  override async getPath(key: unknown[]): Promise<string> {
    const paths = await Promise.all(key.map(hash));
    return posix.join(this.#folder, ...paths);
  }
}

async function hash(value: unknown): Promise<string> {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(
    typeof value === "string" ? value : JSON.stringify(value),
  );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return new Uint8Array(digest).toHex();
}
