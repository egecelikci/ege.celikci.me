import InfiniteScroll from "infinite-scroll";
import imagesLoaded from "imagesloaded";

const SELECTORS = {
  container: ".js-infinitescroll-container",
  item: ".js-infinitescroll-item",
  pagination: ".js-infinitescroll-pagination",
  nextLink: ".js-infinitescroll-next",
};

function infscroll() {
  const container = document.querySelector(SELECTORS.container);
  const nextLink = document.querySelector(SELECTORS.nextLink);

  if (container && nextLink) {
    // Let infinite-scroll know about imagesLoaded
    InfiniteScroll.imagesLoaded = imagesLoaded;

    const path = window.location.pathname;
    let currentPageNum = 0;
    const match = path.match(/\/notes\/(\d+)/);
    if (match && match[1]) {
      currentPageNum = parseInt(match[1], 10);
    }

    const ias = new InfiniteScroll(container, {
      path: function () {
        const pageToLoad = currentPageNum + this.loadCount + 1;
        return `/notes/${pageToLoad}/`;
      },
      append: SELECTORS.item,
      hideNav: SELECTORS.pagination,
      history: false,
      // Set a default, which will be updated dynamically
      scrollThreshold: 400,
    });

    ias.on("append", () => {
      document.dispatchEvent(new CustomEvent("append.infiniteScroll"));
    });

    // This observer dynamically changes the scroll threshold based on the view mode.
    const observer = new MutationObserver(() => {
      const isGridView = container.classList.contains("is-grid-view");
      // Use a higher threshold for grid view so content loads sooner,
      // creating a smoother experience.
      ias.options.scrollThreshold = isGridView ? 1000 : 400;
    });

    observer.observe(container, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Set initial threshold on load, in case the user's preference is grid view.
    const isGridView = container.classList.contains("is-grid-view");
    ias.options.scrollThreshold = isGridView ? 1000 : 400;
  }
}

infscroll();
