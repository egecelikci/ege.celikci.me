import * as path from "jsr:@std/path";
import lume from "lume/mod.ts";
import plugins from "./plugins.ts";
import settings from "./src/_data/site.ts";
import theme from "./src/_data/theme.ts";
import { filters, } from "./utils/filters.ts";
import registerPreprocessors from "./utils/preprocessors.ts";

import "./src/_data/favorite.ts";

const site = lume({
  src: "./src",
  dest: "./dist",
  location: new URL(settings.url,),
},);

site.use(plugins(),);

for (const [name, fn,] of Object.entries(filters,)) {
  site.filter(name, fn as (value: unknown, ...args: unknown[]) => unknown,)
    .filter("cx", theme.cx,);
}

site.addEventListener("afterBuild", async () => {
  console.log("Generating Service Worker…",);

  const command = new Deno.Command("deno", {
    args: ["run", "-A", "npm:workbox-cli", "generateSW", "workbox.config.cjs",],
    env: { NODE_ENV: "production", },
    stdout: "inherit",
    stderr: "inherit",
  },);
  const process = command.spawn();
  await process.status;
},);
registerPreprocessors(site,);

export default site;
