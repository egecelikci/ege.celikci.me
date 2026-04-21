export const layout = "layouts/page.vto";
export const templateEngine = ["vto", "md",];
export const type = "note";
export const show_webmentions = true;

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
