/**
 * Color maths for the palette page. Painting a row in a token color creates text/background pairs the palette never promised, so the text color is measured rather than guessed: the palette's own `text` token that reads best, falling back to plain black/white only when neither reaches the palette's own minimum contrast. Kept pure so `utils/motif.test.ts` can cover it.
 */

/** WCAG relative luminance of a `#rrggbb` color. */
export function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between two `#rrggbb` colors (1…21). */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Text color for a row painted in `bg`: whichever of the two palette `text` tokens reads better there, or black/white when neither meets `minContrast`.
 */
export function onColor(
  bg: string,
  lightText: string,
  darkText: string,
  minContrast = 4.5,
): string {
  const paletteText = contrast(bg, lightText) >= contrast(bg, darkText)
    ? lightText
    : darkText;

  if (contrast(bg, paletteText) >= minContrast) return paletteText;
  return contrast(bg, "#ffffff") >= contrast(bg, "#000000")
    ? "#ffffff"
    : "#000000";
}
