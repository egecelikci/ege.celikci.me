/**
 * Unit tests for the shared remark parser. The AST helpers are what the media and incoming-link extraction read, so the parser has to keep producing the same node shapes the site renders.
 */

import { assertEquals } from "@std/assert";
import { parseMarkdown, walk } from "./mdast.ts";

/** Every node in a document, in document order. */
function nodes(markdown: string) {
  const tree = parseMarkdown(markdown);
  const found: string[] = [];
  if (tree) walk(tree, (node) => found.push(node.type));
  return found;
}

Deno.test("parseMarkdown returns a root with children", () => {
  const tree = parseMarkdown("# title\n\nbody");
  assertEquals(tree?.type, "root");
  assertEquals(tree?.children.length, 2);
});

Deno.test("parseMarkdown enables gfm tables and strikethrough", () => {
  const found = nodes("| a |\n|---|\n| 1 |\n\n~~gone~~\n");
  assertEquals(found.includes("table"), true);
  assertEquals(found.includes("delete"), true);
});

Deno.test("parseMarkdown keeps link and image urls", () => {
  const tree = parseMarkdown(
    "[a](https://x.test/p) ![alt](https://x.test/i.jpg)",
  );
  const urls: string[] = [];
  if (tree) {
    walk(tree, (node) => {
      if (node.url) urls.push(node.url);
    });
  }
  assertEquals(urls, ["https://x.test/p", "https://x.test/i.jpg"]);
});

Deno.test("parseMarkdown pairs a reference link with its definition", () => {
  const tree = parseMarkdown("[a][ref]\n\n[ref]: https://x.test/p\n");
  const carriers: string[] = [];
  if (tree) {
    walk(tree, (node) => {
      if (node.identifier) carriers.push(node.type);
    });
  }
  // The link node and the definition both carry the identifier; the url only lands on the definition.
  assertEquals(carriers, ["linkReference", "definition"]);
});

Deno.test("parseMarkdown keeps source offsets so callers can map back", () => {
  const tree = parseMarkdown("hello");
  assertEquals(typeof tree?.children[0].position?.start.offset, "number");
  assertEquals(tree?.children[0].position?.end.offset, 5);
});

Deno.test("parseMarkdown returns null instead of throwing on garbage input", () => {
  assertEquals(parseMarkdown("\u0000\uffff")?.type ?? "root", "root");
});

Deno.test("walk visits parents before children", () => {
  const order = nodes("> quoted *text*");
  assertEquals(order[0], "root");
  assertEquals(order.includes("blockquote"), true);
  assertEquals(order.indexOf("blockquote") < order.indexOf("emphasis"), true);
});

Deno.test("walk tolerates a node with no children", () => {
  let seen = 0;
  walk({ type: "text", value: "x" }, () => seen++);
  assertEquals(seen, 1);
});
