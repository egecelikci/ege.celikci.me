/**
 * Click-to-toggle for spoiler-veiled media tiles.
 *
 * Tiles rendered with a spoiler carry `.media--spoiled` (or
 * `.gallery__item--spoiled`) plus a `.spoiler-veil` cover acting as a
 * `role="button"`. Activating the veil toggles `.is-revealed` on the
 * tile: the image unblurs and the veil collapses to a slim bar that
 * hides it back. Later clicks anywhere else fall through to the
 * lightbox anchor. No-JS clients ignore the veil via a `<noscript>`
 * style in the base layout and always see the image.
 */

let isSpoilerReady = false;

// Runs at bundle evaluation, before first paint in practice: veils and
// blur only exist while this bundle is alive to toggle them.
document.documentElement.classList.add("has-spoiler");

/**
 * Toggle the spoiled tile owning `veil` between veiled and revealed.
 *
 * @param veil - The `.spoiler-veil` cover being activated.
 */
function toggleTile(veil: HTMLElement): void {
  const tile = veil.closest(".media--spoiled, .gallery__item--spoiled");
  if (!tile) return;
  const revealed = tile.classList.toggle("is-revealed");
  veil.setAttribute("aria-expanded", String(revealed));
  const label = veil.querySelector(".empty-state__title")?.textContent?.trim();
  if (label) {
    veil.setAttribute(
      "aria-label",
      `${revealed ? "Hide" : "Show"} hidden media: ${label}`,
    );
  }
}

/**
 * Find the spoiler veil an event targets, if any.
 *
 * @param target - The event target to test.
 * @returns The veil element, or `null` when the event is unrelated.
 */
function veilTarget(target: EventTarget | null): HTMLElement | null {
  return (target as HTMLElement | null)?.closest?.(".spoiler-veil") as
    | HTMLElement
    | null ?? null;
}

/**
 * Register delegated spoiler toggle handlers (idempotent).
 */
export function initSpoiler(): void {
  if (isSpoilerReady) return;
  isSpoilerReady = true;

  document.addEventListener(
    "click",
    (e) => {
      const veil = veilTarget(e.target);
      if (!veil) return;
      e.preventDefault();
      e.stopPropagation();
      toggleTile(veil);
    },
    { capture: true },
  );

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const veil = veilTarget(e.target);
    if (!veil) return;
    e.preventDefault();
    toggleTile(veil);
  });
}
