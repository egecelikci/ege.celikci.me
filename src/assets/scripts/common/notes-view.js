import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animateGridItems } from "./grid.js";
import { initPhotoSwipe } from "./lightbox.js";

gsap.registerPlugin(ScrollTrigger);

// Debounce function to limit how often a function can run
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedScrollTriggerRefresh = debounce(ScrollTrigger.refresh, 100);

class NotesView {
  constructor() {
    this.container = document.getElementById("notes-container");
    this.toggles = document.querySelectorAll(".notes-view-toggle__btn");
    this.STORAGE_KEY = "notes-view-preference";
    this.currentView = null;

    if (!this.container || !this.toggles.length) return;

    this.init();
  }

  init() {
    this.populateGridItems();

    const savedView = localStorage.getItem(this.STORAGE_KEY) || "list";
    this.setView(savedView); // animate on load

    this.toggles.forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.setView(btn.dataset.view, true);
      }),
    );

    window.addEventListener("load", () => ScrollTrigger.refresh());
  }

  populateGridItems() {
    const items = this.container.querySelectorAll(".notelist__item");
    const isTouch = ScrollTrigger.isTouch === 1;

    items.forEach((item) => {
      if (item.classList.contains("has-processed-grid")) return;

      const gridItem = item.querySelector(".note-grid-item");
      const noteContent = item.querySelector(".note__content");
      if (!gridItem || !noteContent) return;

      const images = [
        ...Array.from(noteContent.querySelectorAll("picture img")),
        ...Array.from(noteContent.querySelectorAll("img:not(picture img)")),
      ];
      if (!images.length) return;

      item.classList.add("has-image", "has-processed-grid");

      const noteLink =
        item.querySelector(".note__link__overlay") ||
        item.querySelector(".note__link");
      const noteUrl = noteLink?.getAttribute("href") || "#";

      let captionText = "";
      try {
        const clone = noteContent.cloneNode(true);
        clone
          .querySelectorAll("img, picture, video, svg, .note-gallery__link")
          .forEach((el) => el.remove());
        captionText = clone.textContent.trim();
      } catch (e) {
        console.warn("Error extracting note text", e);
      }

      const firstImage = images[0];
      const imageSrc = firstImage.currentSrc || firstImage.src;
      const imageSrcset = firstImage.getAttribute("srcset");
      const imageSizes = firstImage.getAttribute("sizes");

      gridItem.innerHTML = `
        <a href="${noteUrl}" class="note-grid-item__link">
          <div class="note-grid-item__image">
            <img 
              src="${imageSrc}" 
              ${imageSrcset ? `srcset="${imageSrcset}"` : ""} 
              ${imageSizes ? `sizes="${imageSizes}"` : ""} 
              alt="" 
              loading="lazy">
          </div>
          ${captionText ? `<div class="note-grid-item__overlay"><p class="note-grid-item__caption">${captionText}</p></div>` : ""}
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

  killTriggers() {
    ScrollTrigger.getAll().forEach((st) => {
      if (st?.trigger && this.container.contains(st.trigger)) st.kill();
    });
  }

  setView(view, animate = true) {
    if (this.currentView === view) return;
    this.currentView = view;

    localStorage.setItem(this.STORAGE_KEY, view);
    const isGrid = view === "grid";

    this.toggles.forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active);
    });

    this.container.classList.toggle("is-grid", isGrid);
    this.killTriggers();

    const gridItems = this.container.querySelectorAll(
      ".notelist__item.has-image .note-grid-item",
    );
    const listItems = this.container.querySelectorAll(
      ".notelist__item .note-social-grid",
    );

    if (isGrid) {
      gridItems.forEach((el) => (el.style.display = "block"));
      if (animate) requestAnimationFrame(() => animateGridItems(gridItems));
    } else {
      listItems.forEach((el) => (el.style.display = ""));
      if (animate) {
        gsap.fromTo(
          listItems,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.05,
            ease: "power3.out",
          },
        );
      }
      gridItems.forEach((el) => (el.style.display = "none"));
    }

    try {
      initPhotoSwipe();
    } catch {}
    debouncedScrollTriggerRefresh();
  }

  refresh() {
    this.populateGridItems();
    const currentView = localStorage.getItem(this.STORAGE_KEY) || "list";
    if (currentView === "grid") {
      const gridItems = this.container.querySelectorAll(
        ".notelist__item.has-image .note-grid-item",
      );
      gridItems.forEach((el) => (el.style.display = "block"));
      animateGridItems(gridItems);
    }
    try {
      initPhotoSwipe();
    } catch {}
    debouncedScrollTriggerRefresh();
  }
}

const notesViewInstance = new NotesView();

document.addEventListener("append.infiniteScroll", () =>
  notesViewInstance.refresh(),
);

export default notesViewInstance;
