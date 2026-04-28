import lumeCMS from "lume/cms/mod.ts";

const cms = lumeCMS({
  basePath: Deno.env.get("CMS_BASE_PATH") || "/admin",
  site: {
    name: "ege.celikci.me CMS",
    url: "https://ege.celikci.me",
  },
});

// Auth configuration
const user = Deno.env.get("CMS_USER") || "admin";
const password = Deno.env.get("CMS_PASSWORD");

if (password) {
  cms.auth({
    [user]: password,
  });
}

// ----------------------------------------------------------------------------
// Content Collections
// ----------------------------------------------------------------------------

cms.collection({
  name: "Posts",
  store: "src:blog/*.md",
  fields: [
    "title: text!",
    {
      name: "date",
      type: "datetime",
      transform: (value) => (value ? value : undefined),
    },
    "content: markdown",
  ],
  documentName(data) {
    // If a date is provided, prepend it (e.g., 2024-05-12-my-title.md)
    if (data.date) {
      const d = new Date(data.date as string).toISOString().split("T")[0];
      return `${d}-${data.title}.md`;
    }
    // Fallback: Just use the title if no date is set
    return `${data.title}.md`;
  },
});

cms.collection({
  name: "Notes",
  store: "src:notes/*.md",
  fields: [
    {
      name: "tags",
      type: "list",
      transform: (value) => (value?.length > 0 ? value : undefined),
    },
    "content: markdown",
  ],
  documentName() {
    // Creates a unique timestamp filename (e.g. 2026-04-28-14-30-00.md)
    const now = new Date();
    const d = now.toISOString().split("T")[0];
    const t = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    return `${d}-${t}.md`;
  },
  documentLabel(name) {
    return name.replace(".md", "");
  },
});

cms.collection({
  name: "Pages",
  store: "src:pages/*.md",
  fields: [
    "title: text!",
    {
      name: "label",
      type: "text",
      transform: (value) => (value?.trim() ? value : undefined),
    },
    {
      name: "templateEngine",
      type: "hidden",
      value: ["vto", "md"],
    },
    "content: markdown",
  ],
});

// ----------------------------------------------------------------------------
// Data Documents (Single Files)
// ----------------------------------------------------------------------------

cms.document({
  name: "Navigation",
  store: "src:_data/navigation.yml",
  fields: [
    {
      name: "primary",
      type: "object-list",
      fields: ["title: text!", "href: text!"],
    },
    {
      name: "secondary",
      type: "object-list",
      fields: ["title: text!", "href: text!"],
    },
  ],
});

// ----------------------------------------------------------------------------
// Data Collections (YAML Arrays)
// ----------------------------------------------------------------------------

cms.collection({
  name: "Bookmarks",
  store: "src:_data/bookmarks.yml",
  type: "object-list",
  fields: [
    "title: text!",
    "url: url",
    "feed: url",
    {
      name: "img",
      type: "file",
      upload: "Badges",
    },
    "desc: textarea",
    "category: text",
    "mirrors: list",
  ],
});

cms.collection({
  name: "Miniflux",
  store: "src:_data/miniflux.yml",
  type: "object-list",
  fields: [
    "title: text!",
    "url: url",
    "feed: url",
    "scraper_rules: text",
    "content_rewrite_rules: text",
  ],
});

cms.collection({
  name: "Uses",
  store: "src:_data/uses.yml",
  type: "object-list",
  fields: [
    "category: text!",
    {
      name: "items",
      type: "object-list",
      fields: [
        "name: text!",
        "url: url",
        "desc: textarea",
      ],
    },
  ],
});

cms.collection({
  name: "Themes",
  store: "src:_data/themes.yml",
  type: "object-list",
  fields: [
    "id: text!",
    "name: text!",
    {
      name: "colors",
      type: "object",
      fields: [
        "primary: color",
        "secondary: color",
        "text: color",
        "border: color",
        "background: color",
        "primaryOffset: color",
        "textOffset: color",
        "backgroundOffset: color",
      ],
    },
  ],
});

cms.collection({
  name: "Webrings",
  store: "src:_data/webrings.yml",
  type: "object-list",
  fields: [
    "name: text!",
    "url: url",
    "prev: url",
    "next: url",
  ],
});

// ----------------------------------------------------------------------------
// Uploads
// ----------------------------------------------------------------------------

cms.upload("Gallery", "src:assets/images/gallery");
cms.upload("Badges", "src:assets/images/88x31");
cms.upload("Images", "src:assets/images");

// ----------------------------------------------------------------------------
// Git Integration
// ----------------------------------------------------------------------------

cms.git({
  prodBranch: "main",
});

export default cms;
