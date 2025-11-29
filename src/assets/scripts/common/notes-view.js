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

        caption = clone.textContent.replace(/\s+/g, " ").trim();
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
  }

  getMultiIcon() {
    return `
      <div class="note-grid-item__badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
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
    this.populateGridItems();
    if (this.currentView === "grid") {
      const newItems = this.container.querySelectorAll(
        ".notelist__item.has-image:not([style*='opacity: 1']) .note-grid-item",
      );
      animateGridItems(newItems);
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
