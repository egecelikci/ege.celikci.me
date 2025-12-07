// deno-lint-ignore-file no-explicit-any
import { eleventyImageTransformPlugin as pluginImageTransform, } from "@11ty/eleventy-img";
import pluginNavigation from "@11ty/eleventy-navigation";
import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import path from "node:path";

import pluginSVGSprite from "eleventy-plugin-svg-sprite";
import pluginPageAssets from "./plugins/page-assets/index.ts";

import type { UserConfig, } from "@11ty/eleventy";
import filters from "./utils/filters.ts";
import markdown from "./utils/markdown.ts";
import registerAlistral from "./utils/prism-alistral.ts";
import {
  asyncShortcodes,
  pairedShortcodes,
  syncShortcodes,
} from "./utils/shortcodes.ts";
import transforms from "./utils/transforms.ts";
import viteHelpers from "./utils/vite.ts";

const IS_PRODUCTION = Deno.env.get("NODE_ENV",) === "production";
const CONTENT_GLOBS = {
  posts: "src/posts/**/*.md",
  drafts: "src/drafts/**/*.md",
  notes: "src/notes/*.md",
  media: "*.jpg|*.png|*.gif|*.mp4|*.webp|*.webm",
};

export default function(config: UserConfig,) {
  // Plugins
  config.addPlugin(pluginRss,);
  config.addPlugin(pluginNavigation,);
  config.addPlugin(pluginSyntaxHighlight, {
    init: function({ Prism, }: { Prism: any; },) {
      registerAlistral(Prism,);
    },
  },);

  // Add support for .ts data files
  config.addDataExtension("ts", {
    parser: async (_content: string, filePath: string,) => {
      const absolutePath = path.resolve(filePath,);
      const fileUrl = new URL(`file://${absolutePath}`,).href;
      const module = await import(fileUrl);
      return module.default;
    },
  },);

  config.addPlugin(pluginPageAssets, {
    mode: "directory",
    postsMatching: "src/posts/*/*.md",
    assetsMatching: CONTENT_GLOBS.media,
    silent: true,
  },);
  config.addPlugin(pluginSVGSprite, {
    path: "./src/assets/icons",
    outputFilepath: "./dist/assets/icons/icons.sprite.svg",
  },);

  // IMPORTANT: Image Transform Plugin Configuration
  config.addPlugin(pluginImageTransform, {
    extensions: "html",
    formats: ["avif", "webp", "auto",],
    outputDir: "./dist/assets/images/processed/",
    urlPath: "/assets/images/processed/",

    // Optimized widths: smaller for grid, medium for list, full for lightbox
    widths: [320, 640, 960, 1280, 1920, "auto",],

    sharpOptions: {
      animated: true,
    },
    sharpWebpOptions: {
      quality: 80,
      effort: 3,
    },
    sharpAvifOptions: {
      quality: 80,
      effort: 3,
    },
    sharpJpegOptions: {
      quality: 85,
      mozjpeg: true,
    },

    dryRun: false,

    defaultAttributes: {
      loading: "lazy",
      decoding: "async",
      sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 600px",
    },

    filenameFormat: function(
      id: any,
      src: any,
      width: any,
      format: any,
      _options: any,
    ) {
      const extension = src.split(".",).pop();
      const name = src.split("/",).pop().replace(`.${extension}`, "",);
      const hash = id.substring(0, 8,);

      if (width === "auto") {
        return `${name}-${hash}.${format}`;
      }
      return `${name}-${hash}-${width}w.${format}`;
    },
  },);

  // Filters
  Object.keys(filters,).forEach((filterName,) => {
    config.addFilter(filterName, filters[filterName as keyof typeof filters],);
  },);

  // Transforms
  config.addTransform("galleryTransform", transforms.galleryTransform,);
  config.addTransform("htmlMinTransform", transforms.htmlMinTransform,);

  // Shortcodes
  if (syncShortcodes) {
    Object.keys(syncShortcodes,).forEach((shortcodeName,) => {
      config.addShortcode(shortcodeName, syncShortcodes[shortcodeName],);
    },);
  }
  if (pairedShortcodes) {
    Object.keys(pairedShortcodes,).forEach((shortcodeName,) => {
      config.addPairedShortcode(
        shortcodeName,
        pairedShortcodes[shortcodeName],
      );
    },);
  }
  if (asyncShortcodes) {
    Object.keys(asyncShortcodes,).forEach((shortcodeName,) => {
      config.addNunjucksAsyncShortcode(
        shortcodeName,
        asyncShortcodes[shortcodeName],
      );
    },);
  }

  config.addPairedShortcode("markdown", (content: string,) => {
    return markdown.render(content,);
  },);

  // Vite Shortcodes
  Object.keys(viteHelpers,).forEach((shortcodeName,) => {
    config.addNunjucksAsyncShortcode(
      shortcodeName,
      viteHelpers[shortcodeName as keyof typeof viteHelpers],
    );
  },);

  // Asset Watch Targets
  config.addWatchTarget("./src/assets",);

  // Markdown Parsing
  config.setLibrary("md", markdown,);

  // Layouts
  config.addLayoutAlias("base", "base.njk",);
  config.addLayoutAlias("page", "page.njk",);
  config.addLayoutAlias("post", "post.njk",);
  config.addLayoutAlias("draft", "draft.njk",);

  // Pass-through files
  config.addPassthroughCopy("src/site.webmanifest",);
  config.addPassthroughCopy("src/assets/images",);
  config.addPassthroughCopy("src/assets/fonts",);

  // Deep-Merge
  config.setDataDeepMerge(true,);

  // Collections: Posts
  config.addCollection("posts", function(collection: any,) {
    return collection
      .getFilteredByGlob(CONTENT_GLOBS.posts,)
      .filter((item: any,) => item.data.permalink !== false)
      .filter((item: any,) => !(item.data.draft && IS_PRODUCTION));
  },);

  // Collections: Drafts
  config.addCollection("drafts", function(collection: any,) {
    return collection
      .getFilteredByGlob(CONTENT_GLOBS.drafts,)
      .filter((item: any,) => item.data.permalink !== false);
  },);

  // Collections: Notes
  config.addCollection("notes", function(collection: any,) {
    return collection.getFilteredByGlob(CONTENT_GLOBS.notes,).reverse();
  },);

  // Base Config
  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "includes",
      layouts: "layouts",
      data: "data",
    },
    templateFormats: ["njk", "md", "11ty.js",],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
