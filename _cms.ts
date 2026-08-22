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

cms.upload({
  name: "images",
  label: "Images",
  description: "Upload images for notes and posts",
  store: "src:assets/images/gallery",
});

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
      name: "syndication",
      type: "object",
      label: "Syndication",
      description: "Links to cross-posted versions of this note",
      transform: (value) =>
        value && Object.values(value).some(Boolean) ? value : undefined,
      fields: [
        {
          name: "mastodon",
          type: "url",
          label: "Mastodon",
        },
        {
          name: "bluesky",
          type: "url",
          label: "Bluesky",
        },
        {
          name: "instagram",
          type: "url",
          label: "Instagram",
        },
      ],
    },
    {
      name: "content",
      type: "markdown",
      label: "Content",
      description: "Markdown body; drop images inline (they become the gallery), or use the image button",
      upload: "images",
    },
  ],
  documentName() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${
      pad(now.getUTCDate())
    }-${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${
      pad(now.getUTCSeconds())
    }.md`;
  },
  rename: false,
});

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
      name: "description",
      type: "textarea",
      label: "Description",
      description: "Short summary used in feeds and page metadata",
    },
    {
      name: "syndication",
      type: "object",
      label: "Syndication",
      description: "Links to cross-posted versions of this post",
      transform: (value) =>
        value && Object.values(value).some(Boolean) ? value : undefined,
      fields: [
        {
          name: "mastodon",
          type: "url",
          label: "Mastodon",
        },
        {
          name: "bluesky",
          type: "url",
          label: "Bluesky",
        },
        {
          name: "instagram",
          type: "url",
          label: "Instagram",
        },
      ],
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
  cms.document({
    name: page.name,
    label: page.label,
    description: "Edit the content of this page",
    store: page.store,
  });
}

export default cms;
