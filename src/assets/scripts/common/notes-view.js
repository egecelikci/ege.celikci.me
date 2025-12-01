import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animateGridItems } from "./grid.js";
import { initPhotoSwipe } from "./lightbox.js";

gsap.registerPlugin(ScrollTrigger);

class NotesView {
  constructor() {
    this.STORAGE_KEY = "notes-view-preference";
    this.resizeObserver = null;
    try {
      this.currentView = localStorage.getItem(this.STORAGE_KEY) || "list";
    } catch (e) {
      this.currentView = "list";
    }
  }

  init() {
    this.container = document.getElementById("notes-container");
    this.toggleContainer = document.querySelector(".view-toggle");

    if (!this.container || !this.toggleContainer) return;

    this.toggleBtns =
      this.toggleContainer.querySelectorAll(".view-toggle__btn");
    this.toggleBg = this.toggleContainer.querySelector(".view-toggle__bg");

    // 1. Setup Toggle (Instant visual set)
    this.updateToggleVisuals(this.currentView, false);
    this.applyView(this.currentView, true);

    // 2. Listeners
    this.toggleHandler = (e) => this.handleToggle(e);
    this.toggleBtns.forEach((btn) => {
      btn.addEventListener("click", this.toggleHandler);
    });

    // 3. Resize Observer
    this.resizeObserver = new ResizeObserver(() => {
      this.updateToggleVisuals(this.currentView, false);
      ScrollTrigger.refresh();
    });
    this.resizeObserver.observe(this.toggleContainer);

    // 4. Infinite Scroll Listener (ROBUSTNESS FIX)
    // When infinite scroll appends items, we must:
    // a) Populate grid items (if they aren't already)
    // b) Animate them if in grid view
    // c) Re-init lightbox to pick up new images
    document.addEventListener("append.infiniteScroll", () => {
      // Populate grid items for the newly added nodes
      this.populateGridItems();

      // Animate only the new items if in grid view
      if (this.currentView === "grid") {
        const newItems = this.container.querySelectorAll(
          ".notelist__item.has-image .note-grid-item",
        );
        if (newItems.length > 0) {
          animateGridItems(newItems);
        }
      }

      // Refresh lightbox to recognize new links
      initPhotoSwipe();
    });
  }

  destroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.toggleBtns) {
      this.toggleBtns.forEach((btn) =>
        btn.removeEventListener("click", this.toggleHandler),
      );
    }
  }

  // --- TOGGLE LOGIC ---
  handleToggle(e) {
    const btn = e.target.closest(".view-toggle__btn");
    if (!btn) return;
    const targetView = btn.dataset.view;
    if (targetView === this.currentView) return;

    this.currentView = targetView;
    try {
      localStorage.setItem(this.STORAGE_KEY, targetView);
    } catch (e) {}

    this.updateToggleVisuals(targetView, true);
    this.applyView(targetView, true);
  }

  updateToggleVisuals(view, animate = true) {
    const activeBtn = this.toggleContainer.querySelector(
      `[data-view="${view}"]`,
    );
    if (!activeBtn) return;

    this.toggleBtns.forEach((btn) => btn.setAttribute("aria-pressed", "false"));
    activeBtn.setAttribute("aria-pressed", "true");

    const { offsetLeft, offsetWidth } = activeBtn;

    if (animate) {
      gsap.to(this.toggleBg, {
        x: offsetLeft,
        width: offsetWidth,
        duration: 0.4,
        ease: "power4.out",
        overwrite: true,
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
          duration: 0.4,
        });

        if (icon) {
          gsap.to(icon, {
            opacity: isActive ? 1 : 0.6,
            stroke: iconColor,
            duration: 0.4,
          });
        }
      });
    } else {
      gsap.set(this.toggleBg, {
        x: offsetLeft,
        width: offsetWidth,
      });

      this.toggleBtns.forEach((btn) => {
        const isActive = btn === activeBtn;
        const icon = btn.querySelector("svg");
        const textColor = isActive
          ? "var(--color-text)"
          : "var(--color-text-offset)";
        const iconColor = isActive ? "var(--color-primary)" : "currentColor";

        gsap.set(btn, {
          color: textColor,
          fontWeight: isActive ? 600 : 400,
        });

        if (icon) {
          gsap.set(icon, {
            opacity: isActive ? 1 : 0.6,
            stroke: iconColor,
          });
        }
      });
    }
  }

  applyView(view, animate) {
    const isGrid = view === "grid";
    this.container.classList.toggle("is-grid-view", isGrid);
    this.container.classList.toggle("is-list-view", !isGrid);

    if (isGrid) {
      // Populate grid items from data attributes
      this.populateGridItems();
    }

    if (animate && isGrid) {
      const selector = ".notelist__item.has-image .note-grid-item";
      const items = this.container.querySelectorAll(selector);
      animateGridItems(items);
    }
    initPhotoSwipe();
    ScrollTrigger.refresh();
  }

  /**
   * NEW: Populate grid items from data attributes
   */
  populateGridItems() {
    const gridItems = this.container.querySelectorAll(
      ".note-grid-item[data-href]",
    );

    gridItems.forEach((gridItem) => {
      // Only populate if empty
      if (gridItem.children.length > 0) return;

      const href = gridItem.dataset.href;
      const src = gridItem.dataset.src;
      const srcset = gridItem.dataset.srcset;
      const alt = gridItem.dataset.alt || "";
      const title = gridItem.dataset.title || "";
      const caption = gridItem.dataset.caption || "";
      const hasMultiple = gridItem.dataset.hasMultiple === "true";

      // Build the grid card HTML
      const html = `
        <a href="${href}" class="note-grid-item__link">
          <div class="note-grid-item__media">
            <img 
              src="${src}"
              ${srcset ? `srcset="${srcset}"` : ""}
              alt="${alt}"
              loading="lazy"
            />
          </div>
          ${
            title || caption
              ? `
            <div class="note-grid-item__overlay">
              <div class="note-grid-item__overlay-content">
                ${title ? `<h3 class="note-grid-item__title">${title}</h3>` : ""}
                ${caption ? `<p class="note-grid-item__caption">${caption}</p>` : ""}
              </div>
            </div>
          `
              : ""
          }
          ${
            hasMultiple
              ? `
            <div class="note-grid-item__badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m22 11l-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16"/><path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2"/><circle cx="13" cy="7" r="1" fill="currentColor"/><rect width="14" height="14" x="8" y="2" rx="2"/></g></svg>
            </div>
          `
              : ""
          }
        </a>
      `;

      gridItem.innerHTML = html;
    });
  }
}

// --- INITIALIZATION ---
const notesContainer = document.getElementById("notes-container");
if (notesContainer) {
  const notesView = new NotesView();
  notesView.init();
}
