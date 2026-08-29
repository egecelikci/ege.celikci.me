import esbuild, { Options as EsbuildOptions } from "lume/plugins/esbuild.ts";
import icons from "lume/plugins/icons.ts";
import inline from "lume/plugins/inline.ts";
import lightningcss from "lume/plugins/lightningcss.ts";
import picture from "lume/plugins/picture.ts";
import sass from "lume/plugins/sass.ts";
import svgo from "lume/plugins/svgo.ts";
import transformImages from "lume/plugins/transform_images.ts";

export interface AssetOptions {
  esbuild?: Partial<EsbuildOptions>;
}

const REMIXICON_VERSION = "4.9.1";

/**
 * RemixIcon names are flat but files live under icons/{Category}/{name}.svg.
 * Build a name → category map from the package's flat file listing.
 */
async function loadRemixCategories(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch(
      `https://data.jsdelivr.com/v1/packages/npm/remixicon@${REMIXICON_VERSION}?structure=flat`,
    );
    const data = await res.json();
    for (const file of data.files ?? []) {
      const m = file.name.match(/^\/icons\/([^/]+)\/([^/]+)\.svg$/);
      if (m) map.set(m[2], m[1]);
    }
  } catch (error) {
    console.warn("[assets] Failed to load RemixIcon categories:", error);
  }
  return map;
}

const remixCategories = await loadRemixCategories();

export default function (options: AssetOptions = {}) {
  const isDev = Deno.env.get("MODE") !== "production";

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
            id: "remixicon",
            src:
              `https://cdn.jsdelivr.net/npm/remixicon@${REMIXICON_VERSION}/icons/{name}.svg`,
            name: (name) => `${remixCategories.get(name) ?? "Others"}/${name}`,
          },
        ],
        spriteFile: "/assets/icons/icons.sprite.svg",
      }))
      .use(inline())
      .use(picture())
      .use(transformImages())
      .add("assets/images")
      .add("assets/fonts")
      .add("assets/scripts/main.ts")
      .add("assets/scripts/collage-worker.ts")
      .add("assets/styles/site.scss")
      .add("assets/styles/vendor/photoswipe.css")
      .add("assets/styles/vendor/leaflet.css");
  };
}
