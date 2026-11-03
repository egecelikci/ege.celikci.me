import lume from "@lumeland/lume";
import { spawn } from "node:child_process";
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
function run(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  return new Promise<number | null>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
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

/** Service Worker generation (bundled + precache manifest injected) */
site.addEventListener("afterBuild", async () => {
  const code = await run("npx", ["--no-install", "serwist", "build"], {
    NODE_ENV: "production",
  });
  // A stale or missing sw.js would serve old pages offline, so a failed bundle fails the build.
  if (code !== 0) {
    throw new Error(`service worker build exited with code ${code}`);
  }
});

export default site;
