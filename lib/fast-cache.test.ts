/**
 * Unit tests for the SHA-256 cache key. A wrong key does not fail anything, it silently stops the cache from ever hitting, so the key has to be stable and distinct per input.
 */

import { assertEquals } from "@std/assert";
import FastCache from "./fast-cache.ts";

const cache = new FastCache({ folder: "_cache" });

Deno.test("FastCache hashes to a stable path", () => {
  assertEquals(cache.getPath(["a"]), cache.getPath(["a"]));
  assertEquals(
    cache.getPath(["https://x/y.webp"]),
    cache.getPath(["https://x/y.webp"]),
  );
});

Deno.test("FastCache separates different keys", () => {
  const paths = new Set([
    cache.getPath(["a"]),
    cache.getPath(["b"]),
    cache.getPath(["a", "b"]),
    cache.getPath(["ab"]),
  ]);
  assertEquals(paths.size, 4);
});

Deno.test("FastCache keeps the folder as the first path segment", () => {
  assertEquals(cache.getPath(["a"]).startsWith("_cache/"), true);
  assertEquals(cache.getPath(["a"]).split("/").length, 2);
});

Deno.test("FastCache joins one digest per key part", () => {
  const one = cache.getPath(["a"]);
  const two = cache.getPath(["a", "b"]);
  assertEquals(two.startsWith(one + "/"), true);
});

Deno.test("FastCache keys a string and its bytes the same", () => {
  const text = cache.getPath(["abc"]);
  const bytes = cache.getPath([new TextEncoder().encode("abc")]);
  assertEquals(text, bytes);
});

Deno.test("FastCache keys objects by their content", () => {
  assertEquals(cache.getPath([{ a: 1 }]), cache.getPath([{ a: 1 }]));
  assertEquals(cache.getPath([{ a: 1 }]) === cache.getPath([{ a: 2 }]), false);
});
