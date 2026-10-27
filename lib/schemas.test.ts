import { assertEquals, assertStrictEquals } from "@std/assert";
import {
  GamesStoreSchema,
  type MBRelation,
  RawIzmirEventsSchema,
  validate,
  type Webmention,
  WebmentionSchema,
} from "./schemas.ts";

/** Compile-time check: `true` only when `A` and `B` are the same type. */
type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends
  (<X>() => X extends B ? 1 : 2) ? true : false;
const assertType = <T extends true>() => {};

const webmention = {
  "wm-id": 1,
  "wm-property": "like-of",
  "wm-source": "https://example.com/like",
  "wm-target": "https://ege.celikci.me/notes/a/",
  "wm-received": "2026-01-01T00:00:00Z",
};

Deno.test("derived types carry no catch-all index signature", () => {
  assertType<Equal<string extends keyof Webmention ? true : false, false>>();
  assertType<Equal<"wm-id" extends keyof Webmention ? true : false, true>>();
});

Deno.test("derived types keep real records", () => {
  type Attributes = NonNullable<MBRelation["attribute-values"]>;
  assertType<Equal<Attributes, Record<string, string>>>();
});

Deno.test("a misspelled webmention field is a compile error", () => {
  // @ts-expect-error `wm-idd` is not a field of Webmention
  const typo: Webmention = { ...webmention, "wm-idd": 2 };
  assertStrictEquals(typo["wm-id"], 1);
});

Deno.test("validation keeps fields the types do not name", () => {
  const parsed = validate(WebmentionSchema, {
    ...webmention,
    "x-extra": "kept",
  });
  assertEquals(
    parsed && (parsed as Record<string, unknown>)["x-extra"],
    "kept",
  );
});

Deno.test("validation rejects a stale or foreign schemaVersion", () => {
  assertEquals(
    validate(GamesStoreSchema, { schemaVersion: 3, games: [] }),
    null,
  );
  assertEquals(
    validate(GamesStoreSchema, { schemaVersion: 4, games: [] }) !== null,
    true,
  );
  assertEquals(
    validate(RawIzmirEventsSchema, { schemaVersion: 2, events: [] }),
    null,
  );
});

Deno.test("webmention author links keep only http(s) urls", () => {
  const parsed = validate(WebmentionSchema, {
    ...webmention,
    author: {
      name: "x",
      url: "javascript:alert(1)",
      photo: "data:image/png;base64,AA",
    },
  });
  assertEquals(parsed?.author?.url, null);
  assertEquals(parsed?.author?.photo, null);
});
