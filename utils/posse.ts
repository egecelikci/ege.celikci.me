import { BskyAgent, RichText } from "npm:@atproto/api";
import { join } from "@std/path";
import { parse, stringify } from "@std/yaml";
import { author, site as siteMeta } from "../_config/metadata.ts";

/**
 * POSSE Lume Plugin
 * Automates cross-posting notes to Fediverse and Bluesky.
 *
 * Safety features:
 * 1. Production Only: Only runs if NETLIFY=true AND CI=true.
 * 2. Recent Only: Only syndicates notes created in the last 24 hours.
 * 3. File Safety: Only stages the exact source files modified by this plugin.
 *
 * Front matter opt-in:
 *   syndication:             — empty key opts in; filled in by plugin after posting
 *   posse:
 *     content: "Custom text" — explicit text for all platforms
 *     use_title: true        | use the page title as body
 *     mastodon:
 *       content: "..."       — platform-specific override
 *     bluesky:
 *       content: "..."
 */
export default function () {
  return (site: any) => {
    let hasUpdates = false;
    // Absolute paths of modified source files — used for surgical git staging
    const updatedFiles = new Set<string>();

    site.process([".html"], async (pages: any[]) => {
      const isNetlify = Deno.env.get("NETLIFY") === "true";
      const isCI = Deno.env.get("CI") === "true";
      if (!isNetlify || !isCI) return;

      // Use 'in' to detect keys even when their value is null (empty YAML key).
      // An empty `syndication:` line opts the note in; the plugin fills it in after posting.
      const notes = pages.filter((p) => {
        if (p.data.type !== "note") return false;
        return "syndication" in p.data;
      });

      console.log(
        `[posse] Checking ${notes.length} note(s) for syndication...`,
      );

      for (const page of notes) {
        const syndication = typeof page.data.syndication === "object" &&
            page.data.syndication !== null
          ? page.data.syndication
          : {};

        const noteDate = page.data.date instanceof Date
          ? page.data.date
          : new Date(page.data.date);
        const hoursOld = (Date.now() - noteDate.getTime()) / (1000 * 60 * 60);
        const isRecent = hoursOld < 24;

        const needsMastodon = !syndication.mastodon && isRecent;
        const needsBluesky = !syndication.bluesky && isRecent;

        console.log(
          `[posse] ${page.data.url} — ${hoursOld.toFixed(1)}h old.` +
            ` Needs: ${needsMastodon ? "Mastodon" : "—"} ${
              needsBluesky ? "Bluesky" : "—"
            }`,
        );

        if (!needsMastodon && !needsBluesky) continue;

        const postData = buildPostData(page);
        const updatedUrls: Record<string, string> = {};
        const usedContent: Record<string, string> = {};

        if (needsMastodon) {
          try {
            const content = getPosseContent(page, "mastodon");
            usedContent.mastodon = content;
            const statusText = constructStatus(postData, content, 500);
            updatedUrls.mastodon = await postToFediverse(
              postData,
              statusText,
              site.src(),
            );
            console.log(`  🔗 Fediverse: ${updatedUrls.mastodon}`);
          } catch (e: any) {
            console.error(`  ❌ Fediverse failed: ${e.message}`);
          }
        }

        if (needsBluesky) {
          try {
            const content = getPosseContent(page, "bluesky");
            usedContent.bluesky = content;
            const statusText = constructStatus(postData, content, 300);
            updatedUrls.bluesky = await postToBluesky(
              postData,
              statusText,
              site.src(),
            );
            console.log(`  🔗 Bluesky: ${updatedUrls.bluesky}`);
          } catch (e: any) {
            console.error(`  ❌ Bluesky failed: ${e.message}`);
          }
        }

        if (Object.keys(updatedUrls).length === 0) continue;

        // page.sourcePath is a Lume v2 getter that returns the path relative
        // to the source root (e.g. "/notes/my-note.md"). join() with site.src()
        // produces the absolute filesystem path for reading/writing.
        const absSourcePath = join(
          site.src(),
          page.sourcePath.slice(1),
        );

        await updateSourceFile(absSourcePath, updatedUrls, usedContent);

        page.data.syndication = { ...syndication, ...updatedUrls };
        hasUpdates = true;
        updatedFiles.add(absSourcePath); // absolute path for git add
      }
    });

    site.addEventListener("afterBuild", async () => {
      const isNetlify = Deno.env.get("NETLIFY") === "true";
      const isCI = Deno.env.get("CI") === "true";
      if (!isNetlify || !isCI || !hasUpdates) return;

      const sshKeyRaw = Deno.env.get("BOT_SSH_KEY");
      if (!sshKeyRaw) {
        console.warn("[posse] BOT_SSH_KEY not set. Skipping git push.");
        return;
      }

      // Write key to a temp file with strict permissions
      const sshKeyPath = await Deno.makeTempFile({ prefix: "posse_ssh_" });
      await Deno.writeTextFile(
        sshKeyPath,
        sshKeyRaw.replace(/\\n/g, "\n"),
      );
      await Deno.chmod(sshKeyPath, 0o600);

      try {
        await commitAndPush(sshKeyPath, Array.from(updatedFiles));
      } finally {
        await Deno.remove(sshKeyPath);
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

function buildPostData(page: any) {
  return {
    url: siteMeta.url + page.data.url,
    tags: (page.data.tags ?? []) as string[],
    images: (
      Array.from(page.document.querySelectorAll("img")) as any[]
    )
      .map((img) => ({
        alt: img.getAttribute("alt") ?? "",
        path: img.getAttribute("src") as string,
      }))
      .filter((img) => img.path && !img.path.startsWith("http")),
  };
}

/**
 * Resolves the body text for a post, in priority order:
 *   1. Platform-specific posse.<platform>.content
 *   2. Generic posse.content
 *   3. Page title (if posse.use_title is true)
 *   4. Empty string → link-only post
 */
function getPosseContent(
  page: any,
  platform: "mastodon" | "bluesky",
): string {
  const posse = page.data.posse;
  if (typeof posse === "object" && posse !== null) {
    if (posse[platform]?.content) return String(posse[platform].content);
    if (posse.content) return String(posse.content);
    if (posse.use_title) return String(page.data.title ?? "");
  }
  return "";
}

/**
 * Builds the status text for a platform, truncating only the body so the
 * canonical URL and hashtags are always preserved intact.
 */
function constructStatus(
  data: ReturnType<typeof buildPostData>,
  content: string,
  limit: number,
): string {
  const suffix = buildSuffix(data);
  const suffixLen = [...suffix].length;
  // Reserve 1 extra char for the ellipsis when truncation is needed
  const bodyBudget = limit - suffixLen - 1;

  let body = content;
  if ([...body].length > bodyBudget) {
    body = [...body].slice(0, bodyBudget).join("") + "…";
  }

  return (body + suffix).trim();
}

function buildSuffix(data: ReturnType<typeof buildPostData>): string {
  // Two newlines = one blank line between body and URL
  const parts = ["", "", data.url];
  if (data.tags.length > 0) {
    parts.push("", data.tags.map((t) => `#${t}`).join(" "));
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Front matter write-back
// ---------------------------------------------------------------------------

async function updateSourceFile(
  filePath: string,
  urls: Record<string, string>,
  contents: Record<string, string>,
) {
  const raw = await Deno.readTextFile(filePath);
  // Split on the front matter delimiters. A valid file looks like:
  // "---\n{yaml}\n---\n{body}"  → parts = ["", yaml, body]
  const parts = raw.split(/^---$/m);
  if (parts.length < 3) {
    console.warn(`[posse] Unexpected front matter format in ${filePath}`);
    return;
  }

  const data = parse(parts[1]) as Record<string, unknown>;

  // 1. Merge syndication URLs
  data.syndication = {
    ...(typeof data.syndication === "object" && data.syndication !== null
      ? data.syndication as Record<string, unknown>
      : {}),
    ...urls,
  };

  // 2. Archive the content that was actually posted, so future builds
  //    can read back the exact text that was syndicated.
  if (typeof data.posse !== "object" || data.posse === null) {
    data.posse = {};
  }
  const posse = data.posse as Record<string, unknown>;

  for (const [platform, text] of Object.entries(contents)) {
    if (!text) continue;
    if (typeof posse[platform] !== "object" || posse[platform] === null) {
      posse[platform] = {};
    }
    const entry = posse[platform] as Record<string, unknown>;
    // Only write if the author hasn't already set it explicitly
    if (!entry.content) entry.content = text;
  }

  // @std/yaml stringify valid options: indent, lineWidth, skipInvalid,
  // useAnchors, styles, schema. (noArrayIndent and quotes are NOT valid.)
  parts[1] = "\n" + stringify(data, {
    indent: 2,
    lineWidth: -1, // never fold long strings
    skipInvalid: true,
  });

  await Deno.writeTextFile(filePath, parts.join("---"));
}

// ---------------------------------------------------------------------------
// Mastodon / Fediverse
// ---------------------------------------------------------------------------

async function postToFediverse(
  data: ReturnType<typeof buildPostData>,
  statusText: string,
  srcPath: string,
): Promise<string> {
  const token = Deno.env.get("FEDI_TOKEN");
  if (!token) throw new Error("FEDI_TOKEN is not set");

  const instanceUrl = new URL(author.social.mastodon.url).hostname;
  const mediaIds: string[] = [];

  for (const img of data.images.slice(0, 4)) {
    const relPath = img.path.startsWith("/") ? img.path.slice(1) : img.path;
    try {
      const fileData = await Deno.readFile(join(srcPath, relPath));
      const form = new FormData();
      form.append(
        "file",
        new Blob([fileData], { type: getMimeType(img.path) }),
      );
      form.append("description", img.alt);

      const res = await fetch(`https://${instanceUrl}/api/v1/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (res.ok) {
        mediaIds.push((await res.json()).id);
      } else {
        console.warn(
          `  ⚠️  Media upload failed (${res.status}): ${img.path}`,
        );
      }
    } catch (e: any) {
      console.warn(`  ⚠️  Could not upload ${img.path}: ${e.message}`);
    }
  }

  const res = await fetch(`https://${instanceUrl}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: statusText,
      media_ids: mediaIds,
      visibility: "public",
    }),
  });

  if (!res.ok) throw new Error(`Mastodon API error: ${res.status}`);
  return (await res.json()).url as string;
}

// ---------------------------------------------------------------------------
// Bluesky
// ---------------------------------------------------------------------------

async function postToBluesky(
  data: ReturnType<typeof buildPostData>,
  statusText: string,
  srcPath: string,
): Promise<string> {
  const password = Deno.env.get("BSKY_APP_PASSWORD");
  if (!password) throw new Error("BSKY_APP_PASSWORD is not set");

  const handle = author.social.bluesky.name.startsWith("@")
    ? author.social.bluesky.name.slice(1)
    : author.social.bluesky.name;

  const agent = new BskyAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: handle, password });
  // Use the resolved DID from the session (more stable than the profile URL)
  const did = agent.session?.did ?? handle;

  const rt = new RichText({ text: statusText });
  await rt.detectFacets(agent);

  const images: { image: unknown; alt: string }[] = [];
  for (const img of data.images.slice(0, 4)) {
    const relPath = img.path.startsWith("/") ? img.path.slice(1) : img.path;
    try {
      const fileData = await Deno.readFile(join(srcPath, relPath));
      const upload = await agent.uploadBlob(fileData, {
        encoding: getMimeType(img.path),
      });
      if (upload.success) {
        images.push({ image: upload.data.blob, alt: img.alt });
      } else {
        console.warn(`  ⚠️  Blob upload failed: ${img.path}`);
      }
    } catch (e: any) {
      console.warn(`  ⚠️  Could not upload ${img.path}: ${e.message}`);
    }
  }

  const res = await agent.post({
    $type: "app.bsky.feed.post",
    text: rt.text,
    facets: rt.facets,
    embed: images.length > 0
      ? { $type: "app.bsky.embed.images", images }
      : undefined,
    createdAt: new Date().toISOString(),
  });

  const postId = res.uri.split("/").pop();
  return `https://bsky.app/profile/${did}/post/${postId}`;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

async function commitAndPush(sshKeyPath: string, files: string[]) {
  const REPO_URL = `git@codeberg.org:${author.username}/${siteMeta.host}.git`;
  const sshCmd = `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no`;

  // These -c flags are ephemeral: they apply only to the single git invocation
  // and leave no trace in .git/config. No --global writes needed.
  const identity = [
    "-c",
    `user.email=${author.email}`,
    "-c",
    `user.name=${author.name}`,
  ];

  const sshAuth = [
    "-c",
    `core.sshCommand=${sshCmd}`,
  ];

  // 1. Stage only the files this plugin touched (absolute paths work with git add)
  const stage = await run("git", ["add", "--", ...files]);
  if (!stage.ok) return;

  // 2. Commit — no signing flags; authentication is handled at push via SSH key
  const commit = await run("git", [
    ...identity,
    "commit",
    "-m",
    "chore: syndicate notes to social [skip ci]",
    "-m",
    "https://indieweb.org/POSSE",
  ]);

  if (!commit.ok) {
    // "nothing to commit" is not an error — the file may already be up to date
    if (!commit.stderr.includes("nothing to commit")) {
      console.error(`[posse] git commit failed:\n${commit.stderr}`);
    }
    return;
  }

  // 3. Push — identity args aren't needed here; SSH key handles auth
  const push = await run("git", [
    ...sshAuth,
    "push",
    REPO_URL,
    "HEAD:main",
  ]);

  if (push.ok) {
    console.log("[posse] ✅ Pushed updates to Codeberg.");
  } else {
    console.error(`[posse] git push failed:\n${push.stderr}`);
  }
}

/** Thin wrapper around Deno.Command that captures stderr and exit code. */
async function run(
  cmd: string,
  args: string[],
): Promise<{ ok: boolean; stderr: string }> {
  const { code, stderr } = await new Deno.Command(cmd, {
    args,
    stderr: "piped",
  }).output();
  return {
    ok: code === 0,
    stderr: new TextDecoder().decode(stderr),
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function getMimeType(path: string): string {
  switch (path.split(".").pop()?.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}
