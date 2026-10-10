export default {
  globDirectory: "dist/",
  // Only what the shell needs offline; feeds, tag JSON, and the sitemap are for other clients and cost about 1.5 MB on a first visit.
  globPatterns: [
    "**/*.{css,js,mjs,ico,svg,woff2,woff}",
    "manifest.json",
    "assets/images/favicon/*.png",
    "offline/index.html",
  ],
  globIgnores: [
    "assets/images/gallery/**/*",
    "assets/images/events/**/*",
    "assets/images/covers/**/*",
    "assets/images/posters/**/*",
    "pagefind/**/*",
    "sw.js",
    "sw.js.map",
  ],
  swSrc: "sw.ts",
  swDest: "dist/sw.js",
  injectionPoint: "self.__SW_MANIFEST",
};
