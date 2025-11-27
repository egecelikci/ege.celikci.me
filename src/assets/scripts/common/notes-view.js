import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animateGridItems } from "./grid.js";
import { initPhotoSwipe } from "./lightbox.js";

gsap.registerPlugin(ScrollTrigger);

class NotesView {
  constructor() {
    this.container = document.getElementById("notes-container");
    this.toggles = document.querySelectorAll(".notes-view-toggle__btn");
    this.STORAGE_KEY = "notes-view-preference";

    if (!this.container || !this.toggles.length) return;

    this.init();
  }

  init() {
    this.populateGridItems();

    const savedView = localStorage.getItem(this.STORAGE_KEY) || "list";
    this.setView(savedView, false);

    this.toggles.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const view = btn.dataset.view;
        if (view) {
          this.setView(view, true);
        }
      });
    });
  }

  populateGridItems() {
    const items = this.container.querySelectorAll(".notelist__item");

    items.forEach((item) => {
      if (item.classList.contains("has-processed-grid")) return;

      const gridItem = item.querySelector(".note-grid-item");
      const noteContent = item.querySelector(".note__content");

      if (!gridItem || !noteContent) return;

      const images = noteContent.querySelectorAll("img");
      if (images.length === 0) return;

      item.classList.add("has-image", "has-processed-grid");

      const noteLink = item.querySelector(".note__link");
      const noteUrl = noteLink ? noteLink.getAttribute("href") : "#";

      // --- Extract Text ---
      let captionText = "";
      try {
        const contentClone = noteContent.cloneNode(true);
        const mediaToRemove = contentClone.querySelectorAll(
          "img, picture, video, svg, .note-gallery__link",
        );
        mediaToRemove.forEach((el) => el.remove());
        captionText = contentClone.textContent.trim();
      } catch (e) {
        console.warn("Error extracting note text", e);
      }
      // --------------------

      const firstImage = images[0];
      const imageSrc = firstImage.currentSrc || firstImage.getAttribute("src");

      // UPDATED HTML STRUCTURE: Added SVG Icon
      gridItem.innerHTML = `
          <a href="${noteUrl}" class="note-grid-item__link">
              <div class="note-grid-item__image">
                  <img src="${imageSrc}" alt="" loading="lazy">
              </div>
              
              ${
                captionText
                  ? `
                  <div class="note-grid-item__overlay">
                      <p class="note-grid-item__caption">${captionText}</p>
                      <svg class="note-grid-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                  </div>
              `
                  : ""
              }

              ${
                images.length > 1
                  ? `
                  <div class="note-grid-item__badge" title="Multiple images">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="3" width="7" height="7"/>
                          <rect x="14" y="3" width="7" height="7"/>
                          <rect x="14" y="14" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/>
                      </svg>
                  </div>
              `
                  : ""
              }
          </a>
      `;
    });
  }

  setView(viewType, animate = true) {
    // Fixed: Ensure `animate` default is handled
    const isGrid = viewType === "grid";

    localStorage.setItem(this.STORAGE_KEY, viewType);

    this.toggles.forEach((btn) => {
      const isActive = btn.dataset.view === viewType;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive);
    });

    if (isGrid) {
      this.container.classList.add("is-grid");
    } else {
      this.container.classList.remove("is-grid");
    }

    ScrollTrigger.getAll().forEach((t) => t.kill());

    if (animate) {
      if (isGrid) {
        this.animateToGrid();
      } else {
        this.animateToList();
      }
    } else {
      // Handle "No Animate" (Initial Page Load)
      if (isGrid) {
        // We can just set opacity 1 immediately or call animate with 0 duration
        this.animateToGrid();
      }
    }

    setTimeout(() => {
      initPhotoSwipe();
    }, 100);
  }

  animateToGrid() {
    const gridItems = this.container.querySelectorAll(
      ".notelist__item.has-image .note-grid-item",
    );
    if (!gridItems.length) return;
    animateGridItems(gridItems);
  }

  animateToList() {
    const listItems = this.container.querySelectorAll(
      ".notelist__item .note-social-grid",
    );
    if (!listItems.length) return;

    gsap.set(listItems, { clearProps: "all" });

    gsap.fromTo(
      listItems,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.05,
        ease: "power3.out",
        scrollTrigger: {
          trigger: this.container,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      },
    );
  }

  refresh() {
    this.populateGridItems();
    const currentView = localStorage.getItem(this.STORAGE_KEY) || "list";
    if (currentView === "grid") {
      // OPTIMIZATION: In the future, you might want to only animate NEW items
      // For now, animating all is safe but cleaner to target newly added ones
      const allGridItems = this.container.querySelectorAll(
        ".notelist__item.has-image .note-grid-item",
      );
      animateGridItems(allGridItems);
    }
  }
}

const notesViewInstance = new NotesView();

document.addEventListener("append.infiniteScroll", () => {
  notesViewInstance.refresh();
});

export default notesViewInstance;
