/**
 * Shared remark parsing helpers. The parser configuration mirrors
 * Lume's remark engine (`_config/markdown.ts`), so AST-based
 * utilities (media extraction, the incoming link graph) see exactly
 * the link/image structure the site actually renders.
 */

import { remarkGfm, remarkParse, unified } from "lume/deps/remark.ts";

export interface MdastNode {
  type: string;
  url?: string;
  identifier?: string;
  title?: string | null;
  alt?: string;
  value?: string;
  children?: MdastNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export interface MdastRoot extends MdastNode {
  type: "root";
  children: MdastNode[];
}

const parser = unified.unified().use(remarkParse).use(remarkGfm);

/** Parse Markdown source into an mdast tree. Returns `null` on failure. */
export function parseMarkdown(content: string): MdastRoot | null {
  try {
    return parser.parse(content) as MdastRoot;
  } catch {
    return null;
  }
}

/** Depth-first walk over an mdast tree. */
export function walk(node: MdastNode, visit: (node: MdastNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) {
    walk(child, visit);
  }
}
