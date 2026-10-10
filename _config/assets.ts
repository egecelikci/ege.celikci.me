import esbuild from "lume/plugins/esbuild.ts";
import icons from "lume/plugins/icons.ts";
import inline from "lume/plugins/inline.ts";
import lightningcss from "lume/plugins/lightningcss.ts";
import picture from "lume/plugins/picture.ts";
import sass from "lume/plugins/sass.ts";
import svgo from "lume/plugins/svgo.ts";
import transformImages from "lume/plugins/transform_images.ts";
import { MOTIF_SHA } from "./metadata.ts";
import { isProduction } from "../utils/env.ts";

const REMIXICON_VERSION = "4.9.1";

/**
 * RemixIcon files live under icons/{Category}/{name}.svg while names are flat.
 * Map the few icons the site uses instead of downloading the whole package listing on every build.
 */
const REMIX_CATEGORIES: Record<string, string> = {
  "fediverse-fill": "Logos",
};

export default function () {
  const isDev = !isProduction;

  return (site: Lume.Site) => {
    site
      .use(sass({
        format: "expanded",
      }))
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
        },
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
            id: "solar",
            src: "https://api.iconify.design/solar/{name}.svg",
          },
          {
            id: "remixicon",
            src:
              `https://cdn.jsdelivr.net/npm/remixicon@${REMIXICON_VERSION}/icons/{name}.svg`,
            name: (name) => `${REMIX_CATEGORIES[name] ?? "Others"}/${name}`,
          },
        ],
        spriteFile: "/assets/icons/icons.sprite.svg",
      }))
      .use(inline())
      .use(picture())
      .use(transformImages())
      /** Palette partial, so `utils/_variables.scss` can `@use "motif"`. A local file at the same path wins over this remote fallback.*/
      .remoteFile(
        "assets/styles/utils/_motif.scss",
        `https://cdn.jsdelivr.net/gh/egecelikci/motif@${MOTIF_SHA}/website/_motif.scss`,
      )
      .add("assets/fonts")
      .add("assets/images")
      .add("assets/tiles")
      .add("sitemap.xsl")
      .add("speculation-rules.json")
      .add("assets/scripts/main.ts")
      .add("assets/scripts/collage-worker.ts")
      .add("assets/styles/site.scss")
      .add("assets/styles/vendor/photoswipe.css")
      .add("assets/styles/vendor/leaflet.css");
  };
}
