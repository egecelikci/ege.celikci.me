/**
 * src/validation/types.ts
 * Data validation layer using type guards (JSR-first approach).
 */

export interface ValidatedNote {
  readonly title: string;
  readonly date: Date;
  readonly type: "note";
  readonly tags?: string[];
}

export interface ValidatedPost {
  readonly title: string;
  readonly date: Date;
  readonly type: "post";
  readonly tags?: string[];
  readonly draft?: boolean;
}

export function isValidNote(data: unknown): data is ValidatedNote {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;

  const hasTitle = typeof d.title === "string" && d.title.length > 0;
  const isNote = typeof d.type === "string" && d.type === "note";
  const hasDate = d.date instanceof Date ||
    (typeof d.date === "string" && !isNaN(Date.parse(d.date)));
  const hasValidTags = !d.tags || Array.isArray(d.tags);

  if (!hasTitle) console.warn("[validation] Note missing title");
  if (!isNote) console.warn("[validation] Data is not a note type");

  return hasTitle && isNote && hasDate && hasValidTags;
}

export function isValidPost(data: unknown): data is ValidatedPost {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;

  const hasTitle = typeof d.title === "string" && d.title.length > 0;
  const isPost = typeof d.type === "string" && d.type === "post";
  const hasDate = d.date instanceof Date ||
    (typeof d.date === "string" && !isNaN(Date.parse(d.date)));
  const hasValidTags = !d.tags || Array.isArray(d.tags);

  if (!hasTitle) console.warn("[validation] Post missing title");
  if (!isPost) console.warn("[validation] Data is not a post type");

  return hasTitle && isPost && hasDate && hasValidTags;
}
