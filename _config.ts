import lume from "lume/mod.ts";
import config from "./_config/index.ts";
import registerPreprocessors from "./utils/preprocessors.ts";
import sw from "./_config/sw.ts";

const site = lume({
  src: "./src",
  dest: "./dist",
  location: new URL("https://ege.celikci.me"),
});

// Modular configuration
site.use(config());

// Preprocessors
registerPreprocessors(site);

const runFetch = async (script: string, label: string) => {
  const cmd = new Deno.Command("deno", {
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
    env: { NODE_ENV: "production" },
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

const isServe = Deno.args.includes("-s") || Deno.args.includes("--serve");
const isDev = Deno.env.get("LUME_ENV") === "development" || isServe;

// Skip heavy data fetching scripts during local development serve
site.addEventListener("beforeBuild", () => {
  if (isDev) {
    console.log("[build] Skipping network fetch scripts in development.");
    return Promise.resolve();
  }
  return Promise.all([
    runFetch("utils/fetch-music.ts", "music"),
    runFetch("utils/fetch-events.ts", "events"),
  ]);
});

// Service Worker generation (bundled + precache manifest injected)
site.use(sw());

export default site;
