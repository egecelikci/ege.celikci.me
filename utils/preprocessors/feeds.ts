/**
 * Automatically injects Atom and JSON feed links into the page header extension.
 */

import createSlugifier from "lume/core/slugifier.ts";

const slugify = createSlugifier();

/** A single link shown in the page header extension */
export interface HeaderSource {
  label: string;
  url: string;
  icon?: string;
  catalog?: string;
  prefix?: string;
  type?: string;
}

/** The props of the SourceMeta component */
export interface HeaderExtensionProps {
  sources?: HeaderSource | HeaderSource[];
  label?: string;
  url?: string;
  icon?: string;
  catalog?: string;
  variant?: string;
}

/**
 * The `headerExtension` data: either a full SourceMeta object
 * or a shorthand where the value IS the props.
 */
export type HeaderExtension =
  | { comp: string; props?: HeaderExtensionProps }
  | HeaderExtensionProps;

/**
 * Automatically injects Atom and JSON feed links into the page header extension.
 * Supports full SourceMeta structure and shorthands.
 */
function injectFeedSources(
  page: Lume.Page<Lume.GlobalData>,
  atomUrl: string,
  jsonUrl: string,
) {
  const raw = page.data.headerExtension;
  let extension: { comp: string; props: HeaderExtensionProps };

  if (raw && typeof raw === "object") {
    if ("comp" in raw) {
      extension = {
        comp: raw.comp,
        props: raw.props ?? { sources: [] },
      };
    } else {
      // Shorthand: extension IS the props
      extension = {
        comp: "layout.SourceMeta",
        props: raw,
      };
    }
  } else {
    extension = {
      comp: "layout.SourceMeta",
      props: { sources: [] },
    };
  }

  // Handle sources as array or single object shorthand
  let sources = extension.props.sources || [];
  if (!Array.isArray(sources)) {
    sources = [sources];
  }

  // If no sources but there are root props (shorthand label/url), migrate them
  if (sources.length === 0 && extension.props.label && extension.props.url) {
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
  if (!sources.find((s) => s.url === atomUrl)) {
    sources.push({ label: "Atom Feed", url: atomUrl });
  }
  if (!sources.find((s) => s.url === jsonUrl)) {
    sources.push({ label: "JSON Feed", url: jsonUrl });
  }

  extension.props.sources = sources;
  page.data.headerExtension = extension;

  page.data.alternateFeeds = [
    { type: "application/atom+xml", url: atomUrl, label: "Atom Feed" },
    { type: "application/feed+json", url: jsonUrl, label: "JSON Feed" },
  ];
}

export default function () {
  return (site: Lume.Site) => {
    site.preprocess("*", (pages) => {
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
          const slug = slugify(page.data.tag as string);
          injectFeedSources(page, `/tags/${slug}.atom`, `/tags/${slug}.json`);

          // Custom override for 'kedi' tag: promote subversive.pics
          if (page.data.tag === "kedi") {
            const extension = page.data.headerExtension;
            if (
              extension && "props" in extension && extension.props &&
              Array.isArray(extension.props.sources)
            ) {
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
