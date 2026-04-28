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
