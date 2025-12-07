const SELECTORS = {
  lazyloadImage: "img[data-src]",
};

function initLazyLoad() {
  if (
    "connection" in navigator && (navigator as any).connection.saveData === true
  ) {
    return;
  }

  const lazyload = (changes: IntersectionObserverEntry[],) => {
    changes.forEach(function(change,) {
      if (change.isIntersecting) {
        const img = change.target as HTMLImageElement;
        const src = img.getAttribute("data-src",);
        if (src) {
          img.setAttribute("src", src,);
        }
        observer.unobserve(change.target,);
      }
    },);
  };
  const observer = new IntersectionObserver(lazyload, {
    rootMargin: "0px 0px 100% 0px",
  },);

  document.querySelectorAll(SELECTORS.lazyloadImage,).forEach((img,) => {
    observer.observe(img,);
  },);
}

if (
  typeof IntersectionObserver !== "undefined"
  && "forEach" in NodeList.prototype
) {
  initLazyLoad();
  (window as any).initLazyLoad = initLazyLoad;
}
