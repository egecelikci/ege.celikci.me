export const layout = "layouts/page.vto";
export const templateEngine = ["vto", "md"];
export const type = "note";
export const show_webmentions = true;

/**
 * URL generator for notes.
 * Extracts all digits from the filename (YYYY-MM-DD-HH-mm-ss)
 * to ensure high-precision, unique URLs like /notes/20250605141506/.
 */
export const url = (page) => {
  const slug = page.src.path.split("/").pop().replace(/\D/g, "");
  return `/notes/${slug}/`;
};
