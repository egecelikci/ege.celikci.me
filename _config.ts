import lume from "@lumeland/lume";
import { spawn } from "node:child_process";
import { getManifest } from "@serwist/build";
import { build } from "esbuild";
import serwistConfig from "./serwist.config.js";
import config from "./_config/index.ts";
import FastCache from "./lib/fast-cache.ts";
import registerPreprocessors from "./plugins/preprocessors/index.ts";
import { isProduction } from "./lib/env.ts";

const site = lume({
  src: "./src",
  dest: "./dist",
  location: new URL("https://ege.celikci.me"),
}, {
  // Templates print MusicBrainz and webmention text, so escape by default and opt trusted HTML in with `|> safe`.
  vento: { options: { autoescape: true } },
});

/** Before any plugin captures `site.cache`. */
if (site.cache) {
  site.cache = new FastCache({ folder: site.root("_cache") });
}

/** Modular configuration */
site.use(config());

/** Preprocessors */
registerPreprocessors(site);

/** Run a command with inherited output and resolve with its exit code. */
function run(command: string, args: string[]) {
  return new Promise<number | null>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", resolve);
  });
}

const runFetch = async (script: string, label: string) => {
  // The data jobs still run on Deno; `DENO` overrides the binary when PATH has none (mise, NixOS).
  const code = await run(process.env.DENO ?? "deno", [
    "run",
    "--allow-net",
    "--allow-read",
    "--allow-write",
    "--allow-env",
    "--allow-ffi",
    "--allow-run",
    script,
  ]).catch(() => null);
  if (code !== 0) {
    console.warn(
      `[${label}] exited with code ${code} — building with cached data.`,
    );
  }
};

/** Only production builds refresh data from the network. */
site.addEventListener("beforeBuild", () => {
  if (!isProduction) {
    console.log("[build] Skipping network fetch scripts in development.");
    return Promise.resolve();
  }
  return Promise.all([
    runFetch("jobs/music.ts", "music"),
    runFetch("jobs/events.ts", "events"),
    runFetch("jobs/steam.ts", "steam"),
  ]);
});

/**
 * Service worker: list what to precache from the finished `dist/`, then bundle `sw.ts` with that list in place of `self.__SW_MANIFEST`.
 *
 * This is what `@serwist/cli build` does, in-process: the CLI wrapper pulled in about a hundred packages of prompts and update checks for two calls. Any failure throws, because a stale or missing sw.js would serve old pages offline.
 */
site.addEventListener("afterBuild", async () => {
  const { swSrc, swDest, injectionPoint, ...globs } = serwistConfig;
  const { count, size, manifestEntries, warnings } = await getManifest(globs);
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
  console.log(`[sw] ${swDest}: precaching ${count} URLs, ${(size / 1024).toFixed(0)} kB`);
});

export default site;
