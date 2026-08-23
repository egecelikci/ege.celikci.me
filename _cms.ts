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

cms.auth({
  [user]: {
    password,
    name: gitName,
    email: gitEmail,
  },
});

cms.git({ prodBranch: "main", remote: "origin", command: gitCommand });

cms.upload(
  {
    name: "images",
    label: "Images",
    description: "Upload images for notes and posts",
    store: "src:assets/images/gallery",
  } satisfies Lume.CMS.UploadOptions,
);

/**
 * builds a unique, sortable filename for a new note from the current UTC time.
 * @returns {string} filename in the form YYYY-MM-DD-HH-mm-ss.md.
 */
function timestampName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${
    pad(now.getUTCDate())
  }-${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${
    pad(now.getUTCSeconds())
  }.md`;
}

/**
 * converts a title into a URL and filename safe slug.
 * @param {string} title - the source title.
 * @returns {string} lowercased slug, non-alphanumeric runs collapsed to "-".
 */
function slugify(title: string): string {
  return title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-");
}

const syndicationField: {
  type: "object";
  label: string;
  description: string;
  transform: (
    value: Record<string, unknown> | undefined,
  ) => Record<string, unknown> | undefined;
  fields: Lume.CMS.Field[];
} = {
  type: "object",
  label: "Syndication",
  description: "Links to cross-posted versions of this entry",
  transform: (value) =>
    value && Object.values(value).some(Boolean) ? value : undefined,
  fields: [
    { name: "mastodon", type: "url", label: "Mastodon" },
    { name: "bluesky", type: "url", label: "Bluesky" },
    { name: "instagram", type: "url", label: "Instagram" },
  ],
};

/**
 * LumeCMS's YAML writer fails on `undefined` values and field transforms are always assigned even when they return `undefined` (e.g. an empty syndication object).
 * Strip such keys so they never reach the front matter. Runs after all field changes are applied, before the document is written.
 * @param {Record<string, unknown>} data - the data to be persisted.
 */
function stripUndefined(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      delete data[key];
    }
  }
}

cms.collection(
  {
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
      { name: "syndication", ...syndicationField },
      {
        name: "content",
        type: "markdown",
        label: "Content",
        description:
          "Markdown body; drop images inline (they become the gallery), or use the image button",
        upload: "images",
      },
    ],
    documentName: timestampName,
    rename: false,
    transform: stripUndefined,
  } satisfies Lume.CMS.CollectionOptions,
);

cms.collection(
  {
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
        name: "description",
        type: "textarea",
        label: "Description",
        description: "Short summary used in feeds and page metadata",
      },
      { name: "syndication", ...syndicationField },
      {
        name: "content",
        type: "markdown",
        label: "Content",
        upload: "images",
      },
    ],
    documentName(data) {
      return data.title ? `${slugify(data.title)}.md` : undefined;
    },
    rename: "auto",
    transform: stripUndefined,
  } satisfies Lume.CMS.CollectionOptions,
);

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
    { name: "offline", store: "src:pages/offline.md", label: "Offline" },
  ]
) {
  cms.document(
    {
      name: page.name,
      label: page.label,
      description: "Edit the content of this page",
      store: page.store,
    } satisfies Lume.CMS.DocumentOptions,
  );
}

export default cms;
