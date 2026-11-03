/**
 * Unit tests for the JSON state helpers: every failure mode returns the default
 * instead of throwing, because the build must survive a corrupt cache.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { z } from "zod";
import { loadState, saveState, sortObjectKeys, StateError } from "./cache.ts";

const DIR = "_cache/test-cache";
const file = (name: string) => `${DIR}/${name}.json`;

Deno.test("loadState returns the default when the file is missing", async () => {
  assertEquals(await loadState(file("absent"), { a: 1 }), { a: 1 });
});

Deno.test("loadState returns the parsed file", async () => {
  await saveState(file("ok"), { b: 2 });
  assertEquals(await loadState(file("ok"), { b: 0 }), { b: 2 });
});

Deno.test("loadState refuses corrupt json instead of returning the default", async () => {
  await Deno.mkdir(DIR, { recursive: true });
  await Deno.writeTextFile(file("corrupt"), "{ not json");
  await assertRejects(
    () => loadState(file("corrupt"), { safe: true }),
    StateError,
    "not valid JSON",
  );
});

Deno.test("loadState refuses data the schema rejects, so a job cannot overwrite it", async () => {
  await saveState(file("stale"), { version: "old" });
  const schema = z.object({ version: z.literal("new") });
  await assertRejects(
    () => loadState(file("stale"), { version: "new" }, schema),
    StateError,
    "failed validation",
  );
  // The stale file is still there for a human to look at.
  assertEquals(JSON.parse(await Deno.readTextFile(file("stale"))), {
    version: "old",
  });
});

Deno.test("loadState accepts data the schema allows", async () => {
  await saveState(file("valid"), { version: "new" as const });
  const schema = z.object({ version: z.literal("new") });
  assertEquals(await loadState(file("valid"), { version: "new" }, schema), {
    version: "new",
  });
});

Deno.test("saveState refuses invalid data and leaves the previous file alone", async () => {
  await saveState(file("kept"), { version: "new" as const });
  const schema = z.object({ version: z.literal("new") });
  await saveState(file("kept"), { version: "bad" }, schema);
  assertEquals(
    JSON.parse(await Deno.readTextFile(file("kept"))),
    { version: "new" },
  );
});

Deno.test("saveState writes keys in a stable order", async () => {
  await saveState(file("sorted"), { z: 1, a: { y: 2, b: 3 } });
  assertEquals(
    await Deno.readTextFile(file("sorted")),
    JSON.stringify({ a: { b: 3, y: 2 }, z: 1 }, null, 2),
  );
});

Deno.test("sortObjectKeys sorts nested objects and maps arrays", () => {
  assertEquals(
    sortObjectKeys({ b: 1, a: [{ d: 1, c: 2 }] }),
    { a: [{ c: 2, d: 1 }], b: 1 },
  );
  assertEquals(sortObjectKeys(null), null);
  assertEquals(sortObjectKeys(5), 5);
  assertEquals(sortObjectKeys("x"), "x");
});

Deno.test("saveState leaves no temporary file behind", async () => {
  await saveState(file("atomic"), { a: 1 });
  assertEquals(JSON.parse(await Deno.readTextFile(file("atomic"))), { a: 1 });
  await assertRejects(
    () => Deno.stat(file("atomic") + ".tmp"),
    Deno.errors.NotFound,
  );
});
