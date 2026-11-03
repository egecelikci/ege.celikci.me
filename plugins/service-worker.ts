import { getManifest } from "@serwist/build";
import { build } from "esbuild";
import serwistConfig from "../serwist.config.js";

/**
 * Build the service worker after Lume has written the site.
 *
 * It lists what to precache from the finished `dist/`, then bundles `sw.ts` with that list in place of `self.__SW_MANIFEST`. This is what `@serwist/cli build` does, done in-process: the CLI wrapper pulled in about a hundred packages of prompts and update checks for these two calls. Any failure throws, because a stale or missing `sw.js` would serve old pages offline.
 *
 * @returns The Lume plugin.
 */
export default function serviceWorker() {
  return (site: Lume.Site) => {
    site.addEventListener("afterBuild", async () => {
      const { swSrc, swDest, injectionPoint, ...globs } = serwistConfig;
      const { count, size, manifestEntries, warnings } =
        await getManifest(globs);
      for (const warning of warnings) console.warn(`[sw] ${warning}`);

      await build({
        entryPoints: [swSrc],
        outfile: swDest,
        bundle: true,
        format: "esm",
        platform: "browser",
        // The baseline the serwist CLI targets.
        target: ["chrome111", "edge111", "firefox111", "safari16"],
        minify: true,
        define: { [injectionPoint]: JSON.stringify(manifestEntries ?? []) },
        logLevel: "warning",
      });
      console.log(
        `[sw] ${swDest}: precaching ${count} URLs, ${(size / 1024).toFixed(
          0,
        )} kB`,
      );
    });
  };
}
