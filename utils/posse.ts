import { BskyAgent, RichText } from "npm:@atproto/api";
import { join } from "@std/path";
import { parse, stringify } from "@std/yaml";
import { author, site as siteMeta } from "../_config/metadata.ts";

/**
 * POSSE Lume Plugin
 * Automates cross-posting notes to Fediverse and Bluesky.
 *
 * Safety features:
 * 1. Production Only: Only runs if NETLIFY=true environment variable is set.
 * 2. Recent Only: Only syndicates notes created in the last 24 hours.
 */
export default function () {
  return (site: any) => {
    let hasUpdates = false; // scoped to this plugin instance

    // We use site.process to access the fully rendered HTML and parsed metadata
    site.process([".html"], async (pages: any[]) => {
      // CRITICAL SAFETY: Never syndicate during local development or non-CI builds
      const isNetlify = Deno.env.get("NETLIFY") === "true";
      if (!isNetlify) return;

      // Filter: has opt-in flag 'syndicate: true' OR an existing 'syndication' block
      const notes = pages.filter((p) =>
        p.data.type === "note" &&
        (p.data.syndicate === true || p.data.syndication)
      );

      for (const page of notes) {
        // Handle syndication results (may be null/absent for new notes)
        const syndication = (typeof page.data.syndication === "object" &&
            page.data.syndication !== null)
          ? page.data.syndication
          : {};

        // Safety: only syndicate if created in the last 24h
        const noteDate = page.data.date instanceof Date
          ? page.data.date
          : new Date(page.data.date);
        const isRecent =
          (new Date().getTime() - noteDate.getTime()) / (1000 * 60 * 60) < 24;

        const needsMastodon = !syndication.mastodon && isRecent;
        const needsBluesky = !syndication.bluesky && isRecent;

        if (!needsMastodon && !needsBluesky) continue;

        console.log(`[posse] Processing: ${page.data.url}`);

        // Extract media and prepare content
        const postData = {
          url: siteMeta.url + page.data.url,
          tags: page.data.tags || [],
          // Extract images from the rendered DOM
          images: Array.from(page.document.querySelectorAll("img")).map((
            img: any,
          ) => ({
            alt: img.getAttribute("alt") || "",
            path: img.getAttribute("src"),
          })).filter((img: any) => img.path && !img.path.startsWith("http")),
        };

        const updatedUrls: Record<string, string> = {};
        const usedContent: Record<string, string> = {};

        // SYNDICATE: Fediverse
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

        // SYNDICATE: Bluesky
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

        // WRITE BACK: Update the source markdown file
        if (Object.keys(updatedUrls).length > 0) {
          const sourcePath = join(site.src(), page.sourcePath.slice(1));
          await updateSourceFile(sourcePath, updatedUrls, usedContent);

          // Update in-memory data for the current build
          page.data.syndication = { ...syndication, ...updatedUrls };
          hasUpdates = true;
        }
      }
    });

    // Git Operations: Push updates back to the repo
    site.addEventListener("afterBuild", async () => {
      const isNetlify = Deno.env.get("NETLIFY") === "true";
      if (!isNetlify || !hasUpdates) return;

      const sshKeyRaw = Deno.env.get("BOT_SSH_KEY");
      if (!sshKeyRaw) {
        console.warn("[posse] No BOT_SSH_KEY found. Skipping git push.");
        return;
      }

      const sshKeyPath = await Deno.makeTempFile();
      await Deno.writeTextFile(sshKeyPath, sshKeyRaw.replace(/\\n/g, "\n"));
      await Deno.chmod(sshKeyPath, 0o600);

      try {
        await commitAndPush(sshKeyPath);
      } finally {
        await Deno.remove(sshKeyPath);
      }
    });
  };
}

// --- Status Builder ---

/**
 * Resolves the content to be used for a social media post based on opt-in rules.
 */
function getPosseContent(page: any, platform: "mastodon" | "bluesky"): string {
  const posse = page.data.posse;
  if (typeof posse === "object" && posse !== null) {
    // 1. Platform-specific override
    if (posse[platform]?.content) return posse[platform].content;
    // 2. Generic content override
    if (posse.content) return posse.content;
    // 3. Opt-in to use title
    if (posse.use_title) return page.data.title || "";
  }
  // 4. Default: No content (just link/tags)
  return "";
}

function constructStatus(data: any, content: string, limit: number): string {
  const suffix = buildSuffix(data);
  const suffixLen = [...suffix].length;
  const bodyBudget = limit - suffixLen - 1; // -1 for ellipsis

  let body = content;
  if ([...body].length > bodyBudget) {
    body = [...body].slice(0, bodyBudget).join("") + "…";
  }

  return (body + suffix).trim();
}

function buildSuffix(data: any): string {
  const parts = ["", "", data.url];
  if (data.tags && data.tags.length > 0) {
    parts.push("");
    parts.push(data.tags.map((t: string) => `#${t}`).join(" "));
  }
  return parts.join("\n");
}

// --- Source File Editor ---

async function updateSourceFile(
  filePath: string,
  urls: Record<string, string>,
  contents: Record<string, string>,
) {
  const raw = await Deno.readTextFile(filePath);
  const parts = raw.split("---");
  if (parts.length < 3) return;

  const data = parse(parts[1]) as any;

  // 1. Update syndication URLs
  data.syndication = { ...data.syndication, ...urls };

  // 2. Archive used content for preset/archival purposes
  if (!data.posse) data.posse = {};
  for (const [platform, text] of Object.entries(contents)) {
    if (text.length === 0) continue;
    if (!data.posse[platform]) data.posse[platform] = {};
    // Only archive if not already explicitly set in frontmatter
    if (!data.posse[platform].content) {
      data.posse[platform].content = text;
    }
  }

  // Use stringify with settings that try to preserve a clean look
  parts[1] = "\n" + stringify(data, {
    indent: 2,
    lineWidth: -1,
    noArrayIndent: true,
    skipInvalid: true,
  });

  await Deno.writeTextFile(filePath, parts.join("---"));
}

// --- API Implementation: Fediverse ---

async function postToFediverse(
  data: any,
  statusText: string,
  srcPath: string,
): Promise<string> {
  const token = Deno.env.get("FEDI_TOKEN");
  if (!token) throw new Error("FEDI_TOKEN is not set");

  const instanceUrl = new URL(author.social.mastodon.url).hostname;
  const mediaIds: string[] = [];

  // Upload Media
  for (const img of data.images.slice(0, 4)) {
    const relPath = img.path.startsWith("/") ? img.path.slice(1) : img.path;
    const filePath = join(srcPath, relPath);
    try {
      const fileData = await Deno.readFile(filePath);
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([fileData], { type: getMimeType(img.path) }),
      );
      formData.append("description", img.alt);

      const mediaRes = await fetch(`https://${instanceUrl}/api/v1/media`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      if (mediaRes.ok) {
        const mediaJson = await mediaRes.json();
        mediaIds.push(mediaJson.id);
      } else {
        console.warn(
          `  ⚠️  Media upload failed (${mediaRes.status}): ${img.path}`,
        );
      }
    } catch (e) {
      console.warn(
        `  ⚠️  Could not read or upload image ${img.path}: ${e.message}`,
      );
    }
  }

  // Create Post
  const res = await fetch(`https://${instanceUrl}/api/v1/statuses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: statusText,
      media_ids: mediaIds,
      visibility: "public",
    }),
  });

  if (!res.ok) throw new Error(`Mastodon API Error: ${res.status}`);
  const resJson = await res.json();
  return resJson.url;
}

// --- API Implementation: Bluesky ---

async function postToBluesky(
  data: any,
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
  const did = agent.session?.did ?? handle;

  const rt = new RichText({ text: statusText });
  await rt.detectFacets(agent);

  const images: any[] = [];
  for (const img of data.images.slice(0, 4)) {
    const relPath = img.path.startsWith("/") ? img.path.slice(1) : img.path;
    const filePath = join(srcPath, relPath);
    try {
      const fileData = await Deno.readFile(filePath);
      const uploadRes = await agent.uploadBlob(fileData, {
        encoding: getMimeType(img.path),
      });
      if (uploadRes.success) {
        images.push({ image: uploadRes.data.blob, alt: img.alt });
      } else {
        console.warn(`  ⚠️  Media upload failed: ${img.path}`);
      }
    } catch (e) {
      console.warn(
        `  ⚠️  Could not read or upload image ${img.path}: ${e.message}`,
      );
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

// --- Git Helpers ---

async function commitAndPush(sshKeyPath: string) {
  const REPO_URL = `git@codeberg.org:${author.username}/${siteMeta.host}.git`;

  const gitCmds = [
    ["config", "--global", "user.email", "~egecelikci/posse@lists.sr.ht"],
    ["config", "--global", "user.name", "POSSE"],
    [
      "config",
      "core.sshCommand",
      `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no`,
    ],
    ["config", "gpg.format", "ssh"],
    ["config", "user.signingkey", sshKeyPath],
    ["config", "commit.gpgsign", "true"],
    ["add", "src/"],
  ];

  for (const args of gitCmds) {
    const { code, stderr } = await new Deno.Command("git", {
      args,
      stderr: "piped",
    }).output();
    if (code !== 0) {
      const msg = new TextDecoder().decode(stderr);
      console.error(`[posse] git ${args[0]} failed: ${msg}`);
      return;
    }
  }

  const commit = new Deno.Command("git", {
    args: [
      "commit",
      "-m",
      "syndicate notes [skip ci]",
      "-m",
      "https://indieweb.org/POSSE",
    ],
    stderr: "piped",
  });

  const { code, stderr } = await commit.output();
  if (code === 0) {
    const push = await new Deno.Command("git", {
      args: ["push", REPO_URL, "HEAD:main"],
      env: {
        GIT_SSH_COMMAND: `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no`,
      },
      stderr: "piped",
    }).output();
    if (push.code === 0) {
      console.log("[posse] ✅ Pushed updates to Codeberg.");
    } else {
      const msg = new TextDecoder().decode(push.stderr);
      console.error(`[posse] git push failed: ${msg}`);
    }
  } else {
    const msg = new TextDecoder().decode(stderr);
    if (!msg.includes("nothing to commit")) {
      console.error(`[posse] git commit failed: ${msg}`);
    }
  }
}

function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
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
