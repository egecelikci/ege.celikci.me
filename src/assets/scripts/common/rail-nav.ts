/**
 * rail-nav.ts
 * Minimal fixed rail navigation shared across pages:
 *  - games: A–Z letters with a breadcrumb "date window" aperture
 *  - notes: years + months (Cryptee-style timeline)
 * Click = smooth scroll, drag-scrub = instant jump, and scroll position
 * (rAF-throttled math, no async observers) drives the active state.
 */

export function initRailNav(rail: HTMLElement) {
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

  const aperture = document.getElementById("game-current-letter");
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  let currentIdx = -1;
  const order = [...sections.keys()];
  const labels = order.map((id) => {
    const link = links.find((l) => l.dataset.target === id);
    return link?.dataset.label || link?.textContent.trim() || "";
  });

  // --- breadcrumb aperture --------------------------------------------------
  // The date wheel is geared to scroll *position*, not direction: each
  // letter owns the band from the top of its group to the top of the next,
  // and the drum sits at the matching fraction of a turn. Every letter is
  // shown while its band passes the window (none is ever skipped), the
  // wheel unwinds when you reverse, and it rests wherever you stop — at
  // any scroll speed, with no fast/slow branches to get out of sync.
  //
  // INACTIVE: the earlier discrete snap-roll is kept commented out below
  // for easy revert (it relies on the CSS spring on .breadcrumb__drum).

  const drum = aperture?.querySelector<HTMLElement>(".breadcrumb__drum");
  const faces = aperture
    ? Array.from(
      aperture.querySelectorAll<HTMLElement>(".breadcrumb__letter-face"),
    )
    : [];
  const wheel = !!drum && faces.length === 2 && !reducedMotion;

  if (drum) drum.style.transition = "none"; // the wheel is geared, not sprung

  /**
   * Seat the drum at `progress` (0–1) through band `idx`. Visual continuity
   * is guaranteed by the geometry: crossing a boundary down, the old state
   * (next glyph visible at -100%) is pixel-identical to the new state
   * (current glyph centered at 0) — and mirrored when crossing up.
   */
  function setAperture(idx: number, progress: number) {
    if (!wheel) {
      for (const face of faces) face.textContent = labels[idx];
      if (drum) drum.style.transform = "translateY(0)";
      return;
    }
    if (faces[0].textContent !== labels[idx]) {
      faces[0].textContent = labels[idx];
    }
    if (idx + 1 < order.length) {
      if (faces[1].textContent !== labels[idx + 1]) {
        faces[1].textContent = labels[idx + 1];
      }
      drum!.style.transform = `translateY(-${(progress * 100).toFixed(2)}%)`;
    } else {
      // last band has no successor — keep the glyph centered
      drum!.style.transform = "translateY(0)";
    }
  }

  /* eslint-disable */
  /*
  // --- snap-roll (previous iteration, inactive) -----------------------------
  // The incoming glyph waits adjacent to the current one; the wheel rolls
  // one step with a mechanical snap, then resets invisibly so the next
  // roll starts from the same position. Direction follows page order.
  let rolling = false;
  let queued: { label: string; dir: 1 | -1 | 0 } | null = null;

  function rollTo(label: string, dir: 1 | -1 | 0) {
    if (!aperture) return;
    const faces = aperture.querySelectorAll<HTMLElement>(
      ".breadcrumb__letter-face",
    );
    const drum = aperture.querySelector<HTMLElement>(".breadcrumb__drum");
    if (!drum || faces.length < 2 || reducedMotion || dir === 0) {
      for (const face of faces) face.textContent = label;
      return;
    }
    if (rolling) {
      queued = { label, dir };
      return;
    }
    rolling = true;

    if (dir === 1) {
      faces[1].textContent = label; // incoming waits below
      drum.style.transform = "translateY(-100%)";
    } else {
      faces[0].textContent = label; // incoming enters from the top
      drum.style.transition = "none";
      drum.style.transform = "translateY(-100%)"; // old glyph fully visible
      void drum.offsetHeight; // commit the jump before animating home
      drum.style.transition = "";
      drum.style.transform = "translateY(0)";
    }

    const settle = () => {
      drum.removeEventListener("transitionend", onEnd);
      window.clearTimeout(timer);
      for (const face of faces) face.textContent = label;
      drum.style.transition = "none";
      drum.style.transform = "translateY(0)";
      void drum.offsetHeight; // commit the reset before the next roll
      drum.style.transition = "";
      rolling = false;
      if (queued) {
        const next = queued;
        queued = null;
        rollTo(next.label, next.dir);
      }
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === drum && e.propertyName === "transform") settle();
    };
    drum.addEventListener("transitionend", onEnd);
    const timer = window.setTimeout(settle, 320); // fallback if the event is swallowed
  }
  */
  /* eslint-enable */

  // --- active state ---------------------------------------------------------
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

  // --- scrolling ------------------------------------------------------------
  function headerHeightPx(): number {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--header-height")
      .trim();
    const num = parseFloat(raw) || 3.5;
    return raw.endsWith("rem") ? num * 16 : num;
  }

  function update() {
    // must match the html scroll-padding the anchors land on, so rail jumps
    // seat their letter exactly centered in the aperture
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
      // fraction of the wheel's turn through this letter's band
      const cur = sections.get(order[idx])!;
      const rel = cur.getBoundingClientRect().top - line;
      const h = cur.offsetHeight || 1;
      setAperture(idx, Math.min(Math.max(-rel / h, 0), 0.999));
    } else {
      setAperture(idx, 0);
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
      // behavior:"auto" inherits the page's CSS smooth scrolling; force instant
      const prev = doc.style.scrollBehavior;
      doc.style.scrollBehavior = "auto";
      section.scrollIntoView({ block: "start" });
      doc.style.scrollBehavior = prev;
    }
    history.replaceState(null, "", `#${id}`);
  }

  // --- pointer interaction --------------------------------------------------
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
      // capture unsupported; click still works
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
    e.preventDefault(); // native anchor jump would fight our scroll
    if (Date.now() - draggedAt < 300) return; // ignore click finishing a drag
    jump(link.dataset.target, true);
  });

  update();
}
