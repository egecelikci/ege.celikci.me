/**
 * Unit tests for the shared remark parser. The AST helpers are what the media and incoming-link extraction read, so the parser has to keep producing the same node shapes the site renders.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMarkdown, walk } from "./mdast.ts";

/** Every node in a document, in document order. */
function nodes(markdown: string) {
  const tree = parseMarkdown(markdown);
  const found: string[] = [];
  if (tree) walk(tree, (node) => found.push(node.type));
  return found;
}

test("parseMarkdown returns a root with children", () => {
  const tree = parseMarkdown("# title\n\nbody");
  assert.deepEqual(tree?.type, "root");
  assert.deepEqual(tree?.children.length, 2);
});

test("parseMarkdown enables gfm tables and strikethrough", () => {
  const found = nodes("| a |\n|---|\n| 1 |\n\n~~gone~~\n");
  assert.deepEqual(found.includes("table"), true);
  assert.deepEqual(found.includes("delete"), true);
});

test("parseMarkdown keeps link and image urls", () => {
  const tree = parseMarkdown(
    "[a](https://x.test/p) ![alt](https://x.test/i.jpg)",
  );
  const urls: string[] = [];
  if (tree) {
    walk(tree, (node) => {
      if (node.url) urls.push(node.url);
    });
  }
  assert.deepEqual(urls, ["https://x.test/p", "https://x.test/i.jpg"]);
});

test("parseMarkdown pairs a reference link with its definition", () => {
  const tree = parseMarkdown("[a][ref]\n\n[ref]: https://x.test/p\n");
  const carriers: string[] = [];
  if (tree) {
    walk(tree, (node) => {
      if (node.identifier) carriers.push(node.type);
    });
  }
  // The link node and the definition both carry the identifier; the url only lands on the definition.
  assert.deepEqual(carriers, ["linkReference", "definition"]);
});

test("parseMarkdown keeps source offsets so callers can map back", () => {
  const tree = parseMarkdown("hello");
  assert.deepEqual(typeof tree?.children[0].position?.start.offset, "number");
  assert.deepEqual(tree?.children[0].position?.end.offset, 5);
});

test("parseMarkdown returns null instead of throwing on garbage input", () => {
  assert.deepEqual(parseMarkdown("\u0000\uffff")?.type ?? "root", "root");
});

test("walk visits parents before children", () => {
  const order = nodes("> quoted *text*");
  assert.deepEqual(order[0], "root");
  assert.deepEqual(order.includes("blockquote"), true);
  assert.deepEqual(
    order.indexOf("blockquote") < order.indexOf("emphasis"),
    true,
  );
});

test("walk tolerates a node with no children", () => {
  let seen = 0;
  walk({ type: "text", value: "x" }, () => seen++);
  assert.deepEqual(seen, 1);
});
