/**
 * Turn a title into a URL and filename safe slug, keeping Turkish letters readable.
 *
 * Lowercases with Turkish rules (`I` → `ı`, `İ` → `i`), folds `ı` to `i`, strips diacritics (`ç` → `c`, `ş` → `s`), collapses everything else to single dashes, and trims them.
 *
 * @param title - The source title.
 * @returns The slug, possibly empty when the title has no letters or digits.
 * @example
 * slugify("Çay Saati!"); // "cay-saati"
 */
export function slugify(title: string): string {
  return title
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
