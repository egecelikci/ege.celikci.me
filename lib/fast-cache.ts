import Cache, { type Options } from "@lumeland/core/cache.ts";
import { createHash } from "node:crypto";
import { posix } from "node:path";

/**
 * Lume's cache keyed by SHA-256 instead of MD5.
 *
 * Image transforms use whole files as cache keys, and every width and format of an image hashes the same file again: about 4 GB per build.
 * Node's MD5 runs at about 700 MB/s and SHA-256, on the CPU's SHA instructions, at about 2.5 GB/s; a cache key only needs to be unique.
 * Remembering the digest per buffer skips nine of ten hashes. A warm build went from 9.3 s (Lume's MD5) to 5.3 s (SHA-256) to 4.0 s (SHA-256, remembered).
 */
export default class FastCache extends Cache {
  #folder: string;

  constructor(options: Options) {
    super(options);
    this.#folder = options.folder;
  }

  override getPath(key: unknown[]): string {
    return posix.join(this.#folder, ...key.map(hash));
  }
}

// shortcut: keyed by buffer identity, so a buffer changed in place after hashing keeps its old key; Lume reads a changed file into a new buffer, revisit if a plugin starts mutating content.
const digests = new WeakMap<Uint8Array, string>();

function hash(value: unknown): string {
  if (value instanceof Uint8Array) {
    let digest = digests.get(value);
    if (!digest) {
      digest = sha256(value);
      digests.set(value, digest);
    }
    return digest;
  }
  return sha256(
    new TextEncoder().encode(
      typeof value === "string" ? value : JSON.stringify(value),
    ),
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
