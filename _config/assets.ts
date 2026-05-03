/**
 * _config/assets.ts
 * Scripts, styles, and images pipeline.
 */

import esbuild, { Options as EsbuildOptions } from "lume/plugins/esbuild.ts";
import icons from "lume/plugins/icons.ts";
import inline from "lume/plugins/inline.ts";
import lightningcss from "lume/plugins/lightningcss.ts";
import picture from "lume/plugins/picture.ts";
import svgo from "lume/plugins/svgo.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
import transformImages from "lume/plugins/transform_images.ts";

export interface AssetOptions {
  esbuild?: Partial<EsbuildOptions>;
}

export default function (options: AssetOptions = {}) {
  const isDev = Deno.env.get("MODE") !== "production";

  return (site: Lume.Site) => {
    site
      .use(tailwindcss())
      .use(lightningcss())
      .use(svgo())
      .use(esbuild({
        extensions: [".ts"],
        options: {
          plugins: [],
          bundle: true,
          format: "esm",
          splitting: true,
          minify: !isDev,
          target: "esnext",
          logLevel: "info",
          chunkNames: "assets/scripts/chunks/[name]-[hash]",
          define: {
            "process.env.MODE": JSON.stringify(
              Deno.env.get("MODE") || "development",
            ),
          },
          ...options.esbuild?.options,
        },
        ...options.esbuild,
      }))
      .use(icons({
        catalogs: [
          {
            id: "lucide",
            src: "https://cdn.jsdelivr.net/npm/lucide-static/icons/{name}.svg",
          },
          {
            id: "simpleicons",
            src: "https://cdn.jsdelivr.net/npm/simple-icons/icons/{name}.svg",
          },
          {
            id: "iconoir",
            src:
              "https://cdn.jsdelivr.net/npm/iconoir@7.11.0/icons/regular/{name}.svg",
          },
          {
            id: "material-symbols",
            src: "https://api.iconify.design/material-symbols:{name}.svg",
          },
        ],
      }))
      .use(inline())
      .use(picture())
      .use(transformImages())
      // Static copies
      .copy("assets/images")
      // Main entry points
      .add("assets/scripts/main.ts")
      .add("assets/scripts/collage-worker.ts")
      .add("assets/styles/main.css");
  };
}
