export const layout = "layouts/note.vto";
export const templateEngine = ["vto", "md",];
export const type = "note";

/**
 * High-precision URL generator for notes.
 * Derives the slug directly from the filename numbers to ensure seconds
 * are preserved regardless of Lume's date extraction precision.
 */
export const url = (page,) => {
  const filename = page.src.path.split("/",).pop() || "";
  const slug = filename.replace(/[^0-9]/g, "",);
  return `/notes/${slug}/`;
};
