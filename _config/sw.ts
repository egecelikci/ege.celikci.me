import { injectManifest } from "@serwist/build";
import { build as esbuild } from "esbuild";

export interface SwOptions {
  swSrc?: string;
  swDest?: string;
  globDirectory?: string;
  globPatterns?: string[];
  globIgnores?: string[];
  injectionPoint?: string;
}

export const defaults = {
  swSrc: "sw.ts",
  swDest: "dist/sw.js",
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
    "sw.js.bundle.js",
  ],
  injectionPoint: "self.__SW_MANIFEST",
} satisfies Required<SwOptions>;

export default function sw(userOptions: Partial<SwOptions> = {}) {
  const options = { ...defaults, ...userOptions };

  return (site: Lume.Site) => {
    site.addEventListener("afterBuild", async () => {
      const bundled = `${options.swDest}.bundle.js`;

      await esbuild({
        entryPoints: [options.swSrc],
        outfile: bundled,
        bundle: true,
        format: "iife",
        minify: true,
        target: "esnext",
        define: { "process.env.NODE_ENV": '"production"' },
      });

      await injectManifest({
        swSrc: bundled,
        swDest: options.swDest,
        globDirectory: options.globDirectory,
        globPatterns: options.globPatterns,
        globIgnores: options.globIgnores,
        injectionPoint: options.injectionPoint,
      });

      await Deno.remove(bundled);
    });
  };
}
