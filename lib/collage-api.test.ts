/** The proxy, the tool and the worker must agree on the URL shape, and every parameter must reach the path, where Netlify's edge cache keys on it. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { collageApiParams, collageApiUrl } from "./collage-api.ts";

const parse = (path: string) =>
  collageApiParams(new URL(path, "https://ege.celikci.me"));

test("every parameter lands in the path, none in the query", () => {
  const url = collageApiUrl("cover", { release: "abc", caa: "123" });
  assert.equal(url, "/api/collage-proxy/cover/release/abc/caa/123");
});

test("a built URL reads back into the same parameters", () => {
  const params = parse(
    collageApiUrl("font", { family: "DM Sans", weight: "400..700" }),
  );
  assert.deepEqual(Object.fromEntries(params!), {
    source: "font",
    family: "DM Sans",
    weight: "400..700",
  });
});

test("values that look like path syntax stay one segment", () => {
  const url = collageApiUrl("lb", { user: "a/b?c", period: "week" });
  assert.equal(parse(url)!.get("user"), "a/b?c");
});

test("the legacy query string form still reads", () => {
  assert.equal(
    parse("/api/collage-proxy?source=cover&mbid=x")!.get("mbid"),
    "x",
  );
});

test("a dangling key or a broken escape is rejected", () => {
  assert.equal(parse("/api/collage-proxy/cover/mbid"), null);
  assert.equal(parse("/api/collage-proxy/cover/mbid/%E0%A4%A"), null);
});
