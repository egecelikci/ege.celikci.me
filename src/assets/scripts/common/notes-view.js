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

    this.toggleBtns =
      this.toggleContainer.querySelectorAll(".view-toggle__btn");
    this.toggleBg = this.toggleContainer.querySelector(".view-toggle__bg");

    // 1. Set Initial State from LocalStorage
    // We force the visual state to match localStorage immediately
    this.updateToggleVisuals(this.currentView, false);
    this.applyView(this.currentView, false);

    // 2. Bind Events
    this.toggleBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => this.handleToggle(e));
    });

    // 3. Resize Handling (Fixes toggle pill position on window resize)
    const resizeObserver = new ResizeObserver(() => {
      this.updateToggleVisuals(this.currentView, false);
      ScrollTrigger.refresh();
    });
    resizeObserver.observe(this.toggleContainer);

    // 4. Global Refresh Handlers
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

  // Note: updateToggleVisuals is removed as CSS handles the toggle UI now.

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

      // Force Reflow: Critical for GSAP to read correct positions after layout change
      void container.offsetHeight;

      if (isGrid) {
        // Only animate visible grid items (those with images)
        const gridItems = container.querySelectorAll(
          ".notelist__item.has-image .note-grid-item",
        );

        if (animate) {
          // 1. Instantly hide items to prevent flash of un-animated content
          gsap.set(gridItems, { opacity: 0 });

          // 2. Trigger the entrance animation
          animateGridItems(gridItems, { immediate: true });
        }
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

    // If switching TO Grid, skip container fade so items can pop in.
    // If switching TO List, use the container fade for smoothness.
    if (animate && !isGrid) {
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
      // Instant swap (letting grid items animate themselves)
      onSwap();
    }
  }

  refresh() {
    if (this.currentView === "grid") {
      const gridItems = this.container.querySelectorAll(
        ".notelist__item.has-image .note-grid-item",
      );
      if (gridItems.length) {
        animateGridItems(gridItems);
      }
    }
    initPhotoSwipe();
    ScrollTrigger.refresh();
  }
}

// Instantiate on DOM Ready to ensure elements exist
function initNotesView() {
  const notesViewInstance = new NotesView();
  notesViewInstance.init();

  // Export for infinite scroll usage
  document.addEventListener("append.infiniteScroll", () => {
    notesViewInstance.refresh();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNotesView);
} else {
  initNotesView();
}
