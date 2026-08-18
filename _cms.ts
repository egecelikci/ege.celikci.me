import lumeCMS from "lume/cms/mod.ts";
import "@std/dotenv/load";
import type { AuthProvider, AuthProviderOptions } from "lume/cms/types.ts";

const user = Deno.env.get("CMS_USER") ?? "admin";
const password = Deno.env.get("CMS_PASSWORD") ?? "";
const secret = Deno.env.get("CMS_SESSION_SECRET") ?? crypto.randomUUID();
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
  extraHead: `
<style>
  body { --font-sans: "DM Sans", system-ui, sans-serif; }
</style>
  `,
});

/**
 * Auth: signed-cookie login form matching the warm look of the site.
 * The session cookie is HMAC-signed so it is safe for production.
 */
class LoginForm implements AuthProvider {
  options!: AuthProviderOptions;

  init(options: AuthProviderOptions) {
    this.options = options;
  }

  async login(request: Request) {
    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.match(/ege_cms_session=([^;]+)/);
    if (match) {
      const [username, sig] = match[1].split(".");
      if (this.options.users.has(username) && sig === (await hmac(username))) {
        return username;
      }
    }

    const basePath = this.options.basePath === "/" ? "" : this.options.basePath;
    return new Response(
      `<!doctype html><html lang="en"><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Sign in · ege.celikci.me</title>
      <style>
        :root{--ink:#2b1f1a;--bg:#fdf6ec;--paper:#ffffff;--line:#e5d5c2;--accent:#a63d1c;--muted:#8a7262}
        *{box-sizing:border-box}
        body{font-family:"DM Sans",system-ui,sans-serif;background:var(--bg);color:var(--ink);
             display:grid;place-items:center;min-height:100vh;margin:0;font-size:15px}
        .card{background:var(--paper);border:1px solid var(--line);border-radius:14px;
              padding:2.25rem;width:min(22rem,90vw);box-shadow:0 10px 40px rgba(43,31,26,.06)}
        h1{font-size:1.05rem;font-weight:600;margin:0 0 .25rem}
        .sub{color:var(--muted);margin:0 0 1.5rem;font-size:.85rem}
        label{display:block;font-size:.78rem;color:var(--muted);margin:0 0 .35rem}
        input{width:100%;padding:.6rem .75rem;border:1px solid var(--line);border-radius:9px;
              font:inherit;background:#fff;margin-bottom:1rem}
        input:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}
        button{width:100%;padding:.65rem;border:0;border-radius:9px;background:var(--accent);
               color:#fff;font:inherit;font-weight:600;cursor:pointer}
        button:hover{filter:brightness(1.05)}
      </style>
      <form method="POST" action="${basePath}/auth/login" class="card">
        <h1>ege.celikci.me</h1>
        <p class="sub">content management</p>
        <label for="user">username</label>
        <input name="user" id="user" autocomplete="username" autofocus required>
        <label for="password">password</label>
        <input name="password" id="password" type="password" autocomplete="current-password" required>
        <button>sign in</button>
      </form>`,
      { headers: { "content-type": "text/html" } },
    );
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/login") && request.method === "POST") {
      const data = await request.formData();
      const name = String(data.get("user") ?? "");
      const pass = String(data.get("password") ?? "");
      const config = this.options.users.get(name);

      if (config && config.password === pass) {
        const sig = await hmac(name);
        return new Response(null, {
          status: 302,
          headers: {
            location: this.options.basePath,
            "set-cookie":
              `ege_cms_session=${name}.${sig}; path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`,
          },
        });
      }

      return new Response("Invalid credentials", { status: 401 });
    }
    return new Response("Not found", { status: 404 });
  }

  logout() {
    return new Response(null, {
      status: 302,
      headers: {
        location: this.options.basePath,
        "set-cookie":
          "ege_cms_session=; path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0",
      },
    });
  }
}

cms.auth(
  {
    [user]: {
      password,
      name: gitName,
      email: gitEmail,
    },
  },
  new LoginForm(),
);

cms.git({ prodBranch: "main", remote: "origin", command: gitCommand });

/**
 * Upload entity for images used in notes and blog posts.
 * The site renders note images into a gallery and pople from
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
    // Notes are named by the current timestamp YYYY-MM-DD-HH-mm-ss, matching
    // the site's URL scheme (every digit becomes part of the note's slug).
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${
      pad(now.getDate())
    }-${pad(now.getHours())}-${pad(now.getMinutes())}-${
      pad(now.getSeconds())
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

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
