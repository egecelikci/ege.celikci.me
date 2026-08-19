import lumeCMS from "lume/cms/mod.ts";
import "@std/dotenv/load";

const user = Deno.env.get("CMS_USER") ?? "admin";
const password = Deno.env.get("CMS_PASSWORD") ?? "";
const gitName = Deno.env.get("CMS_GIT_NAME") ?? user;
const gitEmail = Deno.env.get("CMS_GIT_EMAIL") ??
  `${user}@noreply.git.celikci.me`;
const gitCommand = Deno.env.get("CMS_GIT_COMMAND") ?? "git";

const cms = lumeCMS({
  site: {
    name: "ege.celikci.me",
    description: "Edit the content of Ege's website",
    url: "https://ege.celikci.me",
  },
});

// Browser Basic Auth. The git author identity is bound to this user.
cms.auth({
  [user]: {
    password,
    name: gitName,
    email: gitEmail,
  },
});

cms.git({ prodBranch: "main", remote: "origin", command: gitCommand });

/**
 * Upload entity for images used in notes and blog posts.
 * The site renders note images into a gallery and people from
 * /assets/images/gallery/**, so new uploads land there (Git LFS tracked).
 */
cms.upload({
  name: "images",
  label: "Images",
  description: "Upload images for notes and posts",
  store: "src:assets/images/gallery",
});

/**
 * Notes: ephemeral short-form posts. Files are named YYYY-MM-DD-HH-mm-ss.md
 * (the URL is derived from every digit in the filename).
 */
cms.collection({
  name: "notes",
  label: "Notes",
  description: "Ephemeral updates, logs & short form content",
  store: "src:notes/*.md",
  fields: [
    "title: text",
    {
      name: "tags",
      type: "list",
      label: "Tags",
      description: "e.g. kedi, coffee",
    },
    {
      name: "link",
      type: "url",
      label: "Link",
      description: "Optional link if this note points to something",
    },
    {
      name: "content",
      type: "markdown",
      label: "Content",
      description: "Markdown body; pick images with the image button",
      upload: "images",
    },
  ],
  documentName() {
    // Notes are named by the current UTC timestamp YYYY-MM-DD-HH-mm-ss,
    // matching the site's URL scheme (every digit becomes part of the note's
    // slug) and the site's date handling (which interprets the filename in
    // UTC and renders it in Europe/Istanbul).
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${
      pad(now.getUTCDate())
    }-${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${
      pad(now.getUTCSeconds())
    }.md`;
  },
  // Keep the timestamp filename fixed once created (renaming would change the URL).
  rename: false,
});

/**
 * Blog: longer-form posts.
 */
cms.collection({
  name: "blog",
  label: "Blog",
  description: "Longer-form posts",
  store: "src:blog/*.md",
  fields: [
    "title: text!",
    "date: date",
    {
      name: "tags",
      type: "list",
      label: "Tags",
    },
    {
      name: "content",
      type: "markdown",
      label: "Content",
      upload: "images",
    },
  ],
  documentName(data) {
    return data.title
      ? `${data.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`
      : undefined;
  },
  rename: "auto",
});

/**
 * Standalone pages (like /keys, /contact and /colophon) mix markdown with
 * Vento template syntax, so they are edited as raw code (full file).
 */
for (
  const page of [
    { name: "keys", store: "src:pages/keys.md", label: "Keys" },
    { name: "contact", store: "src:pages/contact.md", label: "Contact" },
    { name: "colophon", store: "src:pages/colophon.md", label: "Colophon" },
    {
      name: "cookies",
      store: "src:pages/chocolate-chip-cookies.md",
      label: "Chocolate chip cookies",
    },
    {
      name: "iced-coffee",
      store: "src:pages/iced-filter-coffee.md",
      label: "Iced filter coffee",
    },
  ]
) {
  cms.document({
    name: page.name,
    label: page.label,
    description: "Edit the content of this page",
    store: page.store,
  });
}

export default cms;
