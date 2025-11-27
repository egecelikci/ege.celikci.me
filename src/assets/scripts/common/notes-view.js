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
    this.currentView = null;
    this.viewDebounce = null; // for debouncing fast switches

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
          this.debounceSetView(view, true);
        }
      });
    });

    window.addEventListener("load", () => ScrollTrigger.refresh());
  }

  debounceSetView(view, animate) {
    clearTimeout(this.viewDebounce);
    this.viewDebounce = setTimeout(() => {
      this.setView(view, animate);
    }, 50); // short delay prevents freezing on fast toggles
  }

  populateGridItems() {
    const items = this.container.querySelectorAll(".notelist__item");
    const isTouch = ScrollTrigger.isTouch === 1;

    items.forEach((item) => {
      if (item.classList.contains("has-processed-grid")) return;

      const gridItem = item.querySelector(".note-grid-item");
      const noteContent = item.querySelector(".note__content");
      if (!gridItem || !noteContent) return;

      const pictures = noteContent.querySelectorAll("picture");
      const standaloneImages = noteContent.querySelectorAll(
        "img:not(picture img)",
      );

      let images = [];
      if (pictures.length > 0) {
        images = Array.from(pictures)
          .map((pic) => pic.querySelector("img"))
          .filter(Boolean);
      }
      if (standaloneImages.length > 0) {
        images = [...images, ...Array.from(standaloneImages)];
      }
      if (images.length === 0) return;

      item.classList.add("has-image", "has-processed-grid");

      const noteLink =
        item.querySelector(".note__link__overlay") ||
        item.querySelector(".note__link");
      const noteUrl = noteLink ? noteLink.getAttribute("href") : "#";

      let captionText = "";
      try {
        const clone = noteContent.cloneNode(true);
        clone
          .querySelectorAll("img, picture, video, svg, .note-gallery__link")
          .forEach((el) => el.remove());
        captionText = clone.textContent.trim();
      } catch (e) {}

      const firstImage = images[0];
      const imageSrc = firstImage.currentSrc || firstImage.getAttribute("src");
      const imageSrcset = firstImage.getAttribute("srcset");
      const imageSizes = firstImage.getAttribute("sizes");

      gridItem.innerHTML = `
        <a href="${noteUrl}" class="note-grid-item__link">
          <div class="note-grid-item__image">
            <img src="${imageSrc}" ${
              imageSrcset ? `srcset="${imageSrcset}"` : ""
            } ${imageSizes ? `sizes="${imageSizes}"` : ""} alt="" loading="lazy">
          </div>
          ${
            captionText
              ? `<div class="note-grid-item__overlay"><p class="note-grid-item__caption">${captionText}</p></div>`
              : ""
          }
          ${
            images.length > 1
              ? `<div class="note-grid-item__badge" title="Multiple images">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                 </div>`
              : ""
          }
        </a>
      `;

      if (isTouch) {
        ScrollTrigger.create({
          trigger: gridItem,
          start: "top 60%",
          end: "bottom 40%",
          toggleClass: "is-active",
        });
      }
    });
  }

  killContainerTriggers() {
    ScrollTrigger.getAll().forEach((st) => {
      try {
        if (!st || !st.trigger) return;
        if (this.container.contains(st.trigger)) st.kill();
      } catch (e) {}
    });
  }

  setView(viewType, animate = true) {
    if (this.currentView === viewType) return;
    this.currentView = viewType;

    const isGrid = viewType === "grid";
    localStorage.setItem(this.STORAGE_KEY, viewType);

    this.toggles.forEach((btn) => {
      const active = btn.dataset.view === viewType;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active);
    });

    if (isGrid) {
      this.container.classList.add("is-grid");
    } else {
      this.container.classList.remove("is-grid");
    }

    // Kill previous triggers
    this.killContainerTriggers();

    // Ensure items are visible per view
    this.container.querySelectorAll(".note-social-grid").forEach((el) => {
      el.style.display = isGrid ? "none" : "";
    });
    this.container.querySelectorAll(".note-grid-item").forEach((el) => {
      el.style.display = isGrid ? "block" : "none";
    });

    // Refresh ScrollTrigger
    setTimeout(() => ScrollTrigger.refresh(), 60);

    // Animate
    if (animate) {
      if (isGrid) this.animateToGrid();
      else this.animateToList();
    }

    // Re-init PhotoSwipe
    setTimeout(() => initPhotoSwipe(), 120);
  }

  animateToGrid() {
    const gridItems = this.container.querySelectorAll(
      ".notelist__item.has-image .note-grid-item",
    );
    if (!gridItems.length) return;

    gridItems.forEach((el) => (el.style.display = "block"));

    requestAnimationFrame(() => animateGridItems(gridItems));
  }

  animateToList() {
    const listItems = this.container.querySelectorAll(
      ".notelist__item .note-social-grid",
    );
    if (!listItems.length) return;

    listItems.forEach((el) => (el.style.display = ""));
    gsap.set(listItems, { opacity: 0, y: 20 });

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
    setTimeout(() => ScrollTrigger.refresh(), 100);

    if (this.currentView === "grid") {
      this.killContainerTriggers();
      const allGridItems = this.container.querySelectorAll(
        ".notelist__item.has-image .note-grid-item",
      );
      animateGridItems(allGridItems);
    }

    initPhotoSwipe();
  }
}

const notesViewInstance = new NotesView();

document.addEventListener("append.infiniteScroll", () => {
  notesViewInstance.refresh();
});

export default notesViewInstance;
