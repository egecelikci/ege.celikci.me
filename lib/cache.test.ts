/** Unit tests for the JSON state helpers: a missing file yields the default, a corrupt or invalid one throws so a job never overwrites it. */

import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { z } from "zod";
import { loadState, saveState, sortObjectKeys, StateError } from "./cache.ts";

const DIR = "_cache/test-cache";
const file = (name: string) => `${DIR}/${name}.json`;

test("loadState returns the default when the file is missing", async () => {
  assert.deepEqual(await loadState(file("absent"), { a: 1 }), { a: 1 });
});

test("loadState returns the parsed file", async () => {
  await saveState(file("ok"), { b: 2 });
  assert.deepEqual(await loadState(file("ok"), { b: 0 }), { b: 2 });
});

test("loadState refuses corrupt json instead of returning the default", async () => {
  await mkdir(DIR, { recursive: true });
  await writeFile(file("corrupt"), "{ not json");
  await assert.rejects(() => loadState(file("corrupt"), { safe: true }), {
    name: StateError.name,
    message: /not valid JSON/,
  });
});

test("loadState refuses data the schema rejects, so a job cannot overwrite it", async () => {
  await saveState(file("stale"), { version: "old" });
  const schema = z.object({ version: z.literal("new") });
  await assert.rejects(
    () => loadState(file("stale"), { version: "new" }, schema),
    { name: StateError.name, message: /failed validation/ },
  );
  // The stale file is still there for a human to look at.
  assert.deepEqual(JSON.parse(await readFile(file("stale"), "utf8")), {
    version: "old",
  });
});

test("loadState accepts data the schema allows", async () => {
  await saveState(file("valid"), { version: "new" as const });
  const schema = z.object({ version: z.literal("new") });
  assert.deepEqual(await loadState(file("valid"), { version: "new" }, schema), {
    version: "new",
  });
});

test("saveState refuses invalid data and leaves the previous file alone", async () => {
  await saveState(file("kept"), { version: "new" as const });
  const schema = z.object({ version: z.literal("new") });
  await saveState(file("kept"), { version: "bad" }, schema);
  assert.deepEqual(JSON.parse(await readFile(file("kept"), "utf8")), {
    version: "new",
  });
});

test("saveState writes keys in a stable order", async () => {
  await saveState(file("sorted"), { z: 1, a: { y: 2, b: 3 } });
  assert.deepEqual(
    await readFile(file("sorted"), "utf8"),
    JSON.stringify({ a: { b: 3, y: 2 }, z: 1 }, null, 2),
  );
});

test("sortObjectKeys sorts nested objects and maps arrays", () => {
  assert.deepEqual(sortObjectKeys({ b: 1, a: [{ d: 1, c: 2 }] }), {
    a: [{ c: 2, d: 1 }],
    b: 1,
  });
  assert.deepEqual(sortObjectKeys(null), null);
  assert.deepEqual(sortObjectKeys(5), 5);
  assert.deepEqual(sortObjectKeys("x"), "x");
});

test("saveState leaves no temporary file behind", async () => {
  await saveState(file("atomic"), { a: 1 });
  assert.deepEqual(JSON.parse(await readFile(file("atomic"), "utf8")), {
    a: 1,
  });
  await assert.rejects(() => stat(file("atomic") + ".tmp"), { code: "ENOENT" });
});
