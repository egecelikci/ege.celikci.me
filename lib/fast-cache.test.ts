/**
 * Unit tests for the SHA-256 cache key. A wrong key does not fail anything, it silently stops the cache from ever hitting, so the key has to be stable and distinct per input.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import FastCache from "./fast-cache.ts";

const cache = new FastCache({ folder: "_cache" });

test("FastCache hashes to a stable path", () => {
  assert.deepEqual(cache.getPath(["a"]), cache.getPath(["a"]));
  assert.deepEqual(
    cache.getPath(["https://x/y.webp"]),
    cache.getPath(["https://x/y.webp"]),
  );
});

test("FastCache separates different keys", () => {
  const paths = new Set([
    cache.getPath(["a"]),
    cache.getPath(["b"]),
    cache.getPath(["a", "b"]),
    cache.getPath(["ab"]),
  ]);
  assert.deepEqual(paths.size, 4);
});

test("FastCache keeps the folder as the first path segment", () => {
  assert.deepEqual(cache.getPath(["a"]).startsWith("_cache/"), true);
  assert.deepEqual(cache.getPath(["a"]).split("/").length, 2);
});

test("FastCache joins one digest per key part", () => {
  const one = cache.getPath(["a"]);
  const two = cache.getPath(["a", "b"]);
  assert.deepEqual(two.startsWith(one + "/"), true);
});

test("FastCache keys a string and its bytes the same", () => {
  const text = cache.getPath(["abc"]);
  const bytes = cache.getPath([new TextEncoder().encode("abc")]);
  assert.deepEqual(text, bytes);
});

test("FastCache keys objects by their content", () => {
  assert.deepEqual(cache.getPath([{ a: 1 }]), cache.getPath([{ a: 1 }]));
  assert.deepEqual(
    cache.getPath([{ a: 1 }]) === cache.getPath([{ a: 2 }]),
    false,
  );
});

test("FastCache gives a buffer hashed twice the same key as fresh equal bytes", () => {
  const image = new TextEncoder().encode("pixels");
  const first = cache.getPath([image, "640w"]);
  assert.equal(
    cache.getPath([image, "1280w"]).split("/")[1],
    first.split("/")[1],
  );
  assert.equal(
    cache.getPath([new TextEncoder().encode("pixels"), "640w"]),
    first,
  );
});
