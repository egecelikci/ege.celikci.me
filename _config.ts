import lume from "lume/mod.ts";
import config from "./_config/index.ts";
import FastCache from "./utils/fast-cache.ts";
import registerPreprocessors from "./utils/preprocessors.ts";
import { isProduction } from "./utils/env.ts";

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

const runFetch = async (script: string, label: string) => {
  // Deno.execPath() is the deno running this build, which a bare "deno" on PATH may not be (mise, NixOS).
  const cmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-ffi",
      "--allow-run",
      script,
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await cmd.spawn().status;
  if (!status.success) {
    console.warn(
      `[${label}] exited with code ${status.code} — building with cached data.`,
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
    runFetch("utils/fetch-music.ts", "music"),
    runFetch("utils/fetch-events.ts", "events"),
    runFetch("utils/fetch-steam.ts", "steam"),
  ]);
});

/** Service Worker generation (bundled + precache manifest injected) */
site.addEventListener("afterBuild", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "@serwist/cli", "build"],
    env: { NODE_ENV: "production" },
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await command.spawn().status;
  // A stale or missing sw.js would serve old pages offline, so a failed bundle fails the build.
  if (!status.success) {
    throw new Error(`service worker build exited with code ${status.code}`);
  }
});

export default site;
