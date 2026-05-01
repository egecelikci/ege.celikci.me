import lume from "lume/mod.ts";
import config from "./_config/index.ts";
import registerPreprocessors from "./utils/preprocessors.ts";

const site = lume({
  src: "./src",
  dest: "./dist",
  location: new URL("https://ege.celikci.me"),
});

// Modular configuration
site.use(config());

// Preprocessors
registerPreprocessors(site);

// Data fetching before build
site.addEventListener("beforeBuild", async () => {
  console.log("Fetching favorite albums…");

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-ffi",
      "--allow-run",
      "utils/fetch-music.ts",
    ],
    env: { NODE_ENV: "production" },
    stdout: "inherit",
    stderr: "inherit",
  });
  const process = command.spawn();
  const status = await process.status;
  if (!status.success) {
    console.warn(
      `[music] fetch-music.ts exited with code ${status.code} — building with cached data.`,
    );
  }
});

site.addEventListener("beforeBuild", async () => {
  console.log("Fetching events…");

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-ffi",
      "--allow-run",
      "utils/fetch-events.ts",
    ],
    env: { NODE_ENV: "production" },
    stdout: "inherit",
    stderr: "inherit",
  });
  const process = command.spawn();
  const status = await process.status;
  if (!status.success) {
    console.warn(
      `[events] fetch-events.ts exited with code ${status.code} — building with cached data.`,
    );
  }
});

// Service Worker generation
site.addEventListener("afterBuild", async () => {
  console.log("Generating Service Worker…");

  const command = new Deno.Command("deno", {
    args: ["run", "-A", "workbox-cli", "generateSW", "workbox.config.cjs"],
    env: { NODE_ENV: "production" },
    stdout: "inherit",
    stderr: "inherit",
  });
  const process = command.spawn();
  await process.status;
});

export default site;
