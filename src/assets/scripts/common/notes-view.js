import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animateGridItems } from "./grid.js";
import { initPhotoSwipe } from "./lightbox.js";

gsap.registerPlugin(ScrollTrigger);

class NotesView {
  constructor() {
    this.STORAGE_KEY = "notes-view-preference";
    this.currentView = localStorage.getItem(this.STORAGE_KEY) || "list";
    this.isAnimating = false;
  }

  init() {
    this.container = document.getElementById("notes-container");
    this.toggleContainer = document.querySelector(".view-toggle");

    // Safety check: if elements aren't found, stop (prevents errors on other pages)
    if (!this.container || !this.toggleContainer) return;

    this.toggleBtns =
      this.toggleContainer.querySelectorAll(".view-toggle__btn");
    this.toggleBg = this.toggleContainer.querySelector(".view-toggle__bg");

    // 1. Prepare DOM (Generate grid cards)
    this.populateGridItems();

    // 2. Set Initial State
    // We force the visual state to match localStorage immediately
    this.updateToggleVisuals(this.currentView, false);
    this.applyView(this.currentView, false);

    // 3. Bind Events
    this.toggleBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => this.handleToggle(e));
    });

    // 4. Resize Handling (Fixes toggle pill position on window resize)
    const resizeObserver = new ResizeObserver(() => {
      this.updateToggleVisuals(this.currentView, false);
      ScrollTrigger.refresh();
    });
    resizeObserver.observe(this.toggleContainer);

    // 5. Global Refresh Handlers
    window.addEventListener("load", () => ScrollTrigger.refresh());
  }

  handleToggle(e) {
    if (this.isAnimating) return;

    // Use currentTarget to ensure we get the button, not the SVG inside it
    const targetView = e.currentTarget.dataset.view;
    if (targetView === this.currentView) return;

    this.isAnimating = true;
    this.currentView = targetView;
    localStorage.setItem(this.STORAGE_KEY, targetView);

    // Animate UI
    this.updateToggleVisuals(targetView, true);
    this.applyView(targetView, true);
  }

  updateToggleVisuals(view, animate = true) {
    const activeBtn = this.toggleContainer.querySelector(
      `[data-view="${view}"]`,
    );
    if (!activeBtn) return;

    // Update ARIA
    this.toggleBtns.forEach((btn) => btn.setAttribute("aria-pressed", "false"));
    activeBtn.setAttribute("aria-pressed", "true");

    // Move the "Pill" background
    const { offsetLeft, offsetWidth } = activeBtn;

    gsap.to(this.toggleBg, {
      x: offsetLeft,
      width: offsetWidth,
      duration: animate ? 0.4 : 0,
      ease: "power4.out",
    });

    this.toggleBtns.forEach((btn) => {
      const isActive = btn === activeBtn;
      const icon = btn.querySelector("svg");
      const textColor = isActive
        ? "var(--color-text)"
        : "var(--color-text-offset)";
      const iconColor = isActive ? "var(--color-primary)" : "currentColor";

      gsap.to(btn, {
        color: textColor,
        fontWeight: isActive ? 600 : 400,
        duration: animate ? 0.4 : 0,
      });

      if (icon) {
        gsap.to(icon, {
          opacity: isActive ? 1 : 0.6,
          stroke: iconColor,
          duration: animate ? 0.4 : 0,
        });
      }
    });
  }

  populateGridItems() {
    // Only process items that haven't been processed yet
    const items = this.container.querySelectorAll(
      ".notelist__item:not(.has-processed-grid)",
    );

    items.forEach((item) => {
      item.classList.add("has-processed-grid");

      const gridContainer = item.querySelector(".note-grid-item");
      const content = item.querySelector(".note__content");

      if (!gridContainer || !content) return;

      const images = [...content.querySelectorAll("img")];
      if (!images.length) return;

      item.classList.add("has-image");

      // --- Richer Content Extraction ---
      const titleEl = content.querySelector(".note__title");
      const title = titleEl ? titleEl.textContent.trim() : "";

      let caption = "";
      try {
        const clone = content.cloneNode(true);

        // Remove title link wrapper to prevent it from being in caption
        const titleLinkInClone = clone.querySelector(".note__link");
        if (titleLinkInClone) {
          titleLinkInClone.remove();
        }

        // Remove gallery links to prevent images from being in caption
        const galleryLinksInClone = clone.querySelectorAll(
          ".note-gallery__link",
        );
        galleryLinksInClone.forEach((el) => el.remove());

        // Remove other media elements
        const media = clone.querySelectorAll("img, video, svg, script, style");
        media.forEach((el) => el.remove());

        caption = clone.innerText.replace(/\s+/g, " ").trim();
      } catch (e) {
        console.warn("Caption extraction failed", e);
      }

      const link =
        item.querySelector("a.note__link")?.getAttribute("href") || "#";
      const img = images[0];
      const src = img.getAttribute("src") || "";
      const srcset = img.getAttribute("srcset") || "";
      const sizes = "(max-width: 600px) 480px, 800px";

      const hasOverlayContent = title || caption;
      const ariaLabel = `View note: ${title}${title && caption ? " - " : ""}${caption}`;
      const altText = `${title}${title && caption ? " - " : ""}${caption}`;

      gridContainer.innerHTML = `
        <a href="${link}" class="note-grid-item__link" aria-label="${ariaLabel}">
          <div class="note-grid-item__media">
            <img src="${src}" srcset="${srcset}" sizes="${sizes}" alt="${altText}" loading="lazy" />
          </div>
          ${
            hasOverlayContent
              ? `<div class="note-grid-item__overlay">
                <div class="note-grid-item__overlay-content">
                  ${title ? `<h3 class="note-grid-item__title">${title}</h3>` : ""}
                  ${caption ? `<p class="note-grid-item__caption">${caption}</p>` : ""}
                </div>
              </div>`
              : ""
          }
          ${images.length > 1 ? this.getMultiIcon() : ""}
        </a>
      `;
    });

    return items;
  }

  getMultiIcon() {
    return `
      <div class="note-grid-item__badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
            <path d="m22 11l-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16"/><path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2"/>
            <circle cx="13" cy="7" r="1" fill="currentColor"/>
            <rect width="14" height="14" x="8" y="2" rx="2"/>
          </g>
        </svg>
      </div>`;
  }

  applyView(view, animate) {
    const isGrid = view === "grid";
    const container = this.container;
    const listItems = container.querySelectorAll(".notelist__item");

    // 1. Cleanup current state triggers
    ScrollTrigger.getAll().forEach((st) => {
      if (container.contains(st.trigger)) st.kill();
    });

    // 2. Animate Swap
    const onSwap = () => {
      container.classList.toggle("is-grid-view", isGrid);
      container.classList.toggle("is-list-view", !isGrid);

      if (isGrid) {
        // Only animate visible grid items (those with images)
        const gridItems = container.querySelectorAll(
          ".notelist__item.has-image .note-grid-item",
        );
        if (animate) animateGridItems(gridItems);
      } else {
        if (animate) {
          gsap.fromTo(
            listItems,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, stagger: 0.05, clearProps: "all" },
          );
        }
      }

      try {
        initPhotoSwipe();
      } catch (e) {}
      ScrollTrigger.refresh();
      this.isAnimating = false;
    };

    if (animate) {
      // Fade out container, swap class, fade in
      gsap.to(container, {
        opacity: 0,
        y: 10,
        duration: 0.2,
        onComplete: () => {
          onSwap();
          gsap.to(container, { opacity: 1, y: 0, duration: 0.3, delay: 0.1 });
        },
      });
    } else {
      onSwap();
    }
  }

  refresh() {
    const newItems = this.populateGridItems();
    if (this.currentView === "grid") {
      const targets = [];
      newItems.forEach((item) => {
        if (item.classList.contains("has-image")) {
          const gridItem = item.querySelector(".note-grid-item");
          if (gridItem) targets.push(gridItem);
        }
      });

      if (targets.length) {
        animateGridItems(targets);
      }
    }
    initPhotoSwipe();
    ScrollTrigger.refresh();
  }
}

// Instantiate on DOM Ready to ensure elements exist
document.addEventListener("DOMContentLoaded", () => {
  const notesViewInstance = new NotesView();
  notesViewInstance.init();

  // Export for infinite scroll usage
  document.addEventListener("append.infiniteScroll", () => {
    notesViewInstance.refresh();
  });
});
