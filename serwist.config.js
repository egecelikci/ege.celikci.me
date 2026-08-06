export default {
  globDirectory: "dist/",
  globPatterns: [
    "**/*.{css,js,mjs,json,xml,ico,svg,woff2,woff}",
    "assets/images/favicon/*.png",
    "assets/images/88x31/*.png",
    "offline/index.html",
  ],
  globIgnores: [
    "assets/images/gallery/**/*",
    "assets/images/events/**/*",
    "assets/images/covers/**/*",
    "assets/images/posters/**/*",
    "sw.js",
    "sw.js.map",
  ],
  swSrc: "sw.ts",
  swDest: "dist/sw.js",
  injectionPoint: "self.__SW_MANIFEST",
};
