/**
 * Unit tests for the schema.org page classification.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { pageType } from "./schema.ts";

test("pageType classifies the wrapper by page", () => {
  assert.deepEqual(pageType({ url: "/" }), "https://schema.org/WebSite");
  assert.deepEqual(
    pageType({ url: "/tags/kedi/", type: "tag" }),
    "https://schema.org/CollectionPage",
  );
  assert.deepEqual(
    pageType({ url: "/notes/", type: "index" }),
    "https://schema.org/CollectionPage",
  );
  assert.deepEqual(
    pageType({ url: "/notes/1/", type: "note" }),
    "https://schema.org/WebPage",
  );
  assert.deepEqual(
    pageType({ url: "/colophon/" }),
    "https://schema.org/WebPage",
  );
  assert.deepEqual(
    pageType({ url: "/music/" }),
    "https://schema.org/CollectionPage",
  );
});
