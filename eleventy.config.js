import path from "path";

import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginNavigation from "@11ty/eleventy-navigation";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import { eleventyImageTransformPlugin as pluginImageTransform } from "@11ty/eleventy-img";

import pluginPageAssets from "eleventy-plugin-page-assets";
import pluginSVGSprite from "eleventy-plugin-svg-sprite";

import filters from "./utils/filters.js";
import transforms from "./utils/transforms.js";
import shortcodes from "./utils/shortcodes.js";
import markdown from "./utils/markdown.js";
import viteHelpers from "./utils/vite.js";
import imageHelpers from "./utils/imageHelpers.js";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CONTENT_GLOBS = {
  posts: "src/posts/**/*.md",
  drafts: "src/drafts/**/*.md",
  notes: "src/notes/*.md",
  media: "*.jpg|*.png|*.gif|*.mp4|*.webp|*.webm",
};

export default function (config) {
  // Plugins
  config.addPlugin(pluginRss);
  config.addPlugin(pluginNavigation);
  config.addPlugin(pluginSyntaxHighlight);
  config.addPlugin(pluginPageAssets, {
    mode: "directory",
    postsMatching: "src/posts/*/*.md",
    assetsMatching: CONTENT_GLOBS.media,
    silent: true,
  });
  config.addPlugin(pluginSVGSprite, {
    path: "./src/assets/icons",
    outputFilepath: "./dist/assets/icons/icons.sprite.svg",
  });

  // IMPORTANT: Image Transform Plugin Configuration
  config.addPlugin(pluginImageTransform, {
    extensions: "html",
    formats: ["avif", "auto"],
    outputDir: "./dist/assets/images/processed/",
    urlPath: "/assets/images/processed/",

    // Optimized widths: smaller for grid, medium for list, full for lightbox
    widths: [320, 640, 960, 1280, "auto"],

    dryRun: false,

    defaultAttributes: {
      loading: "lazy",
      decoding: "async",
      sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 600px",
    },

    filenameFormat: function (id, src, width, format, options) {
      const extension = src.split(".").pop();
      const name = src.split("/").pop().replace(`.${extension}`, "");
      const hash = id.substring(0, 8);

      if (width === "auto") {
        return `${name}-${hash}.${format}`;
      }
      return `${name}-${hash}-${width}w.${format}`;
    },
  });

  // Filters
  Object.keys(filters).forEach((filterName) => {
    config.addFilter(filterName, filters[filterName]);
  });

  // Transforms
  config.addTransform("galleryTransform", transforms.galleryTransform);
  config.addTransform("htmlMinTransform", transforms.htmlMinTransform);

  // Shortcodes
  Object.keys(shortcodes).forEach((shortcodeName) => {
    config.addShortcode(shortcodeName, shortcodes[shortcodeName]);
  });

  config.addPairedShortcode("markdown", (content) => {
    return markdown.render(content);
  });

  // Vite Shortcodes
  Object.keys(viteHelpers).forEach((shortcodeName) => {
    config.addNunjucksAsyncShortcode(shortcodeName, viteHelpers[shortcodeName]);
  });

  // Image helpers
  if (imageHelpers) {
    Object.keys(imageHelpers).forEach((shortcodeName) => {
      config.addNunjucksAsyncShortcode(
        shortcodeName,
        imageHelpers[shortcodeName],
      );
    });
  }

  // Asset Watch Targets
  config.addWatchTarget("./src/assets");

  // Markdown Parsing
  config.setLibrary("md", markdown);

  // Layouts
  config.addLayoutAlias("base", "base.njk");
  config.addLayoutAlias("page", "page.njk");
  config.addLayoutAlias("post", "post.njk");
  config.addLayoutAlias("draft", "draft.njk");

  // Pass-through files
  config.addPassthroughCopy("src/site.webmanifest");
  config.addPassthroughCopy("src/assets/images");
  config.addPassthroughCopy("src/assets/fonts");

  // Deep-Merge
  config.setDataDeepMerge(true);

  // Collections: Posts
  config.addCollection("posts", function (collection) {
    return collection
      .getFilteredByGlob(CONTENT_GLOBS.posts)
      .filter((item) => item.data.permalink !== false)
      .filter((item) => !(item.data.draft && IS_PRODUCTION));
  });

  // Collections: Drafts
  config.addCollection("drafts", function (collection) {
    return collection
      .getFilteredByGlob(CONTENT_GLOBS.drafts)
      .filter((item) => item.data.permalink !== false);
  });

  // Collections: Notes
  config.addCollection("notes", function (collection) {
    return collection.getFilteredByGlob(CONTENT_GLOBS.notes).reverse();
  });

  // Base Config
  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "includes",
      layouts: "layouts",
      data: "data",
    },
    templateFormats: ["njk", "md", "11ty.js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
