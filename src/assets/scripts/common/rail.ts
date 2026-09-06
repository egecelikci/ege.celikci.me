import { initAperture } from "./aperture.ts";

export function initRail(rail: HTMLElement) {
  const links = Array.from(
    rail.querySelectorAll<HTMLAnchorElement>("a[data-target]"),
  );
  if (links.length === 0) return;

  const sections = new Map<string, HTMLElement>();
  for (const link of links) {
    const id = link.dataset.target;
    if (!id || sections.has(id)) continue;
    const section = document.getElementById(id);
    if (section) sections.set(id, section);
  }
  if (sections.size === 0) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  let currentIdx = -1;
  const order = [...sections.keys()];
  const labels = order.map((id) => {
    const link = links.find((l) => l.dataset.target === id);
    return link?.dataset.label || link?.textContent.trim() || "";
  });

  const aperture = document.getElementById("game-current-letter");
  const setWheel = aperture ? initAperture(aperture, labels) : null;

  function setActive(idx: number) {
    if (idx === currentIdx) return;
    currentIdx = idx;
    const id = order[idx];
    const section = sections.get(id)!;

    for (const link of links) {
      const on = link.dataset.target === id ||
        (link.classList.contains("rail__link--primary") &&
          link.dataset.year !== undefined &&
          section.dataset.year === link.dataset.year);
      link.classList.toggle("is-active", on);
      if (on) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  }

  function headerHeightPx(): number {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--header-height")
      .trim();
    const num = parseFloat(raw) || 3.5;
    return raw.endsWith("rem") ? num * 16 : num;
  }

  function update() {
    const line = headerHeightPx() + 1;
    let idx = -1;
    for (let i = 0; i < order.length; i++) {
      if (sections.get(order[i])!.getBoundingClientRect().top - line <= 0) {
        idx = i;
      } else break;
    }
    if (idx === -1) idx = 0;
    if (
      window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
    ) {
      idx = order.length - 1;
    }

    setActive(idx);

    if (idx + 1 < order.length) {
      const cur = sections.get(order[idx])!;
      const rel = cur.getBoundingClientRect().top - line;
      const h = cur.offsetHeight || 1;
      setWheel?.(idx, Math.min(Math.max(-rel / h, 0), 0.999));
    } else {
      setWheel?.(idx, 0);
    }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      update();
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  function jump(id: string, smooth: boolean) {
    const section = sections.get(id);
    if (!section) return;
    const doc = document.documentElement;
    if (smooth && !reducedMotion) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      const prev = doc.style.scrollBehavior;
      doc.style.scrollBehavior = "auto";
      section.scrollIntoView({ block: "start" });
      doc.style.scrollBehavior = prev;
    }
    history.replaceState(null, "", `#${id}`);
  }

  let scrubbing = false;
  let draggedAt = 0;

  function linkAt(x: number, y: number): HTMLAnchorElement | null {
    const el = document.elementFromPoint(x, y);
    return (el?.closest?.("a[data-target]") as HTMLAnchorElement | null) ??
      null;
  }

  rail.addEventListener("pointerdown", (e) => {
    const link = linkAt(e.clientX, e.clientY);
    if (!link?.dataset.target) return;
    scrubbing = true;
    try {
      rail.setPointerCapture(e.pointerId);
    } catch {
    }
    jump(link.dataset.target, false);
  });

  rail.addEventListener("pointermove", (e) => {
    if (!scrubbing) return;
    const link = linkAt(e.clientX, e.clientY);
    if (link?.dataset.target) jump(link.dataset.target, false);
  });

  const stop = () => {
    if (scrubbing) draggedAt = Date.now();
    scrubbing = false;
  };
  rail.addEventListener("pointerup", stop);
  rail.addEventListener("pointercancel", stop);

  rail.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement).closest(
      "a[data-target]",
    ) as HTMLAnchorElement | null;
    if (!link?.dataset.target) return;
    e.preventDefault();
    if (Date.now() - draggedAt < 300) return;
    jump(link.dataset.target, true);
  });

  update();
}
