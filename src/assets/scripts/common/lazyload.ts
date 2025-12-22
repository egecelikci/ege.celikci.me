export function initLazyLoad() {
  if (
    "connection" in navigator && (navigator as any).connection.saveData === true
  ) {
    return;
  }

  const lazyload = (changes: IntersectionObserverEntry[],) => {
    changes.forEach((change,) => {
      if (change.isIntersecting) {
        const image = change.target as HTMLImageElement;
        const dataSrc = image.getAttribute("data-src",);
        if (dataSrc) {
          image.setAttribute("src", dataSrc,);
          observer.unobserve(image,);
        }
      }
    },);
  };

  const observer = new IntersectionObserver(lazyload, {
    rootMargin: "0px 0px 100% 0px",
  },);

  document.querySelectorAll("img[data-src]",).forEach((img,) => {
    observer.observe(img,);
  },);
}
