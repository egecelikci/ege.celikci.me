import lume from "@lumeland/lume";
import { spawn } from "node:child_process";
import { log } from "@lumeland/core/utils/log.ts";
import config from "./_config/index.ts";
import serviceWorker from "./plugins/service-worker.ts";
import FastCache from "./lib/fast-cache.ts";
import registerPreprocessors from "./plugins/preprocessors/index.ts";
import { isProduction } from "./lib/env.ts";

const site = lume(
  {
    src: "./src",
    dest: "./dist",
    location: new URL("https://ege.celikci.me"),
  },
  {
    // Templates print MusicBrainz and webmention text, so escape by default and opt trusted HTML in with `|> safe`.
    vento: { options: { autoescape: true } },
  },
);

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

/** Run a data job in its own Node process, so a crash in one never takes the build down. */
const runFetch = async (script: string, label: string) => {
  const code = await run(process.execPath, [script]).catch(() => null);
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

/** `lume build` logs render errors and still exits 0, which would deploy pages that lost their content or layout. */
site.addEventListener("afterBuild", () => {
  if (log.hasErrors) process.exitCode = 1;
});

/** Service worker, built from `sw.ts` once the site is written. */
site.use(serviceWorker());

export default site;
