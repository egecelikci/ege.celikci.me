/**
 * utils/preprocessors/feeds.ts
 * Automatically injects Atom and JSON feed links into the page header extension.
 */

import type { Page, Site } from "lume/core.ts";

/**
 * Automatically injects Atom and JSON feed links into the page header extension.
 * Supports full SourceMeta structure and shorthands.
 */
function injectFeedSources(page: Page, atomUrl: string, jsonUrl: string) {
  let extension = page.data.headerExtension;

  // Convert shorthand or missing extension to full object
  if (!extension || typeof extension !== "object") {
    extension = {
      comp: "ui.SourceMeta",
      props: { sources: [] },
    };
  } else if (!extension.comp) {
    // Shorthand: extension IS the props
    extension = {
      comp: "ui.SourceMeta",
      props: extension,
    };
  }

  if (!extension.props) {
    extension.props = { sources: [] };
  }

  // Handle sources as array or single object shorthand
  let sources = extension.props.sources || [];
  if (!Array.isArray(sources)) {
    sources = [sources];
  }

  // If no sources but there are root props (shorthand label/url), migrate them
  if (sources.length === 0 && extension.props.label) {
    sources.push({
      label: extension.props.label,
      url: extension.props.url,
      icon: extension.props.icon,
      catalog: extension.props.catalog,
    });
    // Clean up migrated props to avoid double-rendering
    delete extension.props.label;
    delete extension.props.url;
    delete extension.props.icon;
    delete extension.props.catalog;
  }

  // Add feeds if not already present
  if (!sources.find((s: any) => s.url === atomUrl)) {
    sources.push({ label: "Atom Feed", url: atomUrl });
  }
  if (!sources.find((s: any) => s.url === jsonUrl)) {
    sources.push({ label: "JSON Feed", url: jsonUrl });
  }

  extension.props.sources = sources;
  page.data.headerExtension = extension;
}

export default function () {
  return (site: Site) => {
    site.preprocess("*", (pages: Page[]) => {
      for (const page of pages) {
        const pageUrl = page.data.url as string;
        if (!pageUrl) continue;

        // --- AUTOMATIC FEED PROMOTION ---
        // 1. Index Pages
        if (pageUrl === "/blog/") {
          injectFeedSources(page, "/blog.atom", "/blog.json");
        } else if (pageUrl === "/notes/") {
          injectFeedSources(page, "/notes.atom", "/notes.json");
        } else if (pageUrl === "/events/") {
          injectFeedSources(page, "/events.atom", "/events.json");
        }

        // 2. Tag Pages
        if (page.data.type === "tag" && page.data.tag) {
          // Access slugify helper from site.renderer.helpers (registered by slugify_urls plugin)
          const slugifyHelper = (site as any).renderer.helpers.get("slugify");
          const slugify = slugifyHelper ? slugifyHelper[0] : null;

          if (!slugify) {
            throw new Error(
              `[preprocessor] 'slugify' helper missing. Is 'slugify_urls' plugin enabled?`,
            );
          }
          const slug = slugify(page.data.tag);
          injectFeedSources(page, `/tags/${slug}.atom`, `/tags/${slug}.json`);

          // Custom override for 'kedi' tag: promote subversive.pics
          if (page.data.tag === "kedi") {
            const extension = page.data.headerExtension;
            if (extension && extension.props && extension.props.sources) {
              extension.props.sources.unshift({
                label: "subversive.pics",
                url: "https://subversive.pics/",
                icon: "image",
                prefix: "Also available at",
              });
            }
          }
        }
      }
    });
  };
}
