export default function () {
  return (site: Lume.Site) => {
    site.preprocess("*", (pages) => {
      for (const page of pages) {
        if (!page.data.date && page.data.updated) {
          page.data.date = page.data.updated;
        }
      }
    });
  };
}
