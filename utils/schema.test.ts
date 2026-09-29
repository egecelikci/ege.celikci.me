/**
 * Unit tests for the schema.org page classification.
 */

import { assertEquals } from "@std/assert";
import { pageType } from "./schema.ts";

Deno.test("pageType classifies the wrapper by page", () => {
  assertEquals(pageType({ url: "/" }), "https://schema.org/WebSite");
  assertEquals(
    pageType({ url: "/tags/kedi/", type: "tag" }),
    "https://schema.org/CollectionPage",
  );
  assertEquals(
    pageType({ url: "/notes/", type: "index" }),
    "https://schema.org/CollectionPage",
  );
  assertEquals(
    pageType({ url: "/notes/1/", type: "note" }),
    "https://schema.org/WebPage",
  );
  assertEquals(pageType({ url: "/colophon/" }), "https://schema.org/WebPage");
  assertEquals(
    pageType({ url: "/music/" }),
    "https://schema.org/CollectionPage",
  );
});
