/** The smoke check must flag exactly the mix-ups the edge cache produced, and nothing a healthy deploy returns. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { problems } from "./smoke-collage-proxy.ts";

const cover = (url: string, hash: string, type = "image/jpeg") => ({
  url,
  status: 200,
  type,
  hash,
});
const stats = (url: string, type = "application/json") => ({
  url,
  status: 200,
  type,
  hash: url,
});

test("a healthy round has no problems", () => {
  assert.deepEqual(
    problems([stats("/s1")], [cover("/c1", "a"), cover("/c2", "b")]),
    [],
  );
});

test("a cover answered with stats JSON is flagged", () => {
  assert.equal(problems([], [cover("/c1", "a", "application/json")]).length, 1);
});

test("stats answered with an image is flagged", () => {
  assert.equal(problems([stats("/s1", "image/jpeg")], []).length, 1);
});

test("two different covers with identical bytes are flagged", () => {
  assert.equal(
    problems([], [cover("/c1", "same"), cover("/c2", "same")]).length,
    1,
  );
});

test("upstream errors are not counted as mix-ups", () => {
  assert.deepEqual(
    problems(
      [],
      [{ url: "/c1", status: 502, type: "application/json", hash: "x" }],
    ),
    [],
  );
});
