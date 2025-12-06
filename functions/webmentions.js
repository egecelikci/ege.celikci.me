const API_ORIGIN = "https://webmention.io/api/mentions.jf2";
const BASE_URL = "ege.celikci.me";

/**
 * simpleSanitize - A lightweight, zero-dependency HTML sanitizer.
 */
const simpleSanitize = (str) => {
  if (!str) return "";

  let clean = str.replace(
    /<(script|style|iframe|object|embed|svg|form|input|button)[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );

  return clean.replace(
    /<\/?([a-z0-9]+)([^>]*)>/gi,
    (fullTag, tagName, attributes) => {
      tagName = tagName.toLowerCase();
      const allowedTags = ["b", "i", "em", "strong", "a"];

      if (!allowedTags.includes(tagName)) {
        return "";
      }

      if (fullTag.startsWith("</")) {
        return `</${tagName}>`;
      }

      if (tagName === "a") {
        const hrefMatch = attributes.match(/href=(["'])(.*?)\1/i);
        if (hrefMatch) {
          let url = hrefMatch[2].trim();
          if (
            url.toLowerCase().startsWith("javascript:") ||
            url.toLowerCase().startsWith("data:")
          ) {
            return "";
          }
          return `<a href="${url}" target="_blank" rel="noopener noreferrer">`;
        }
        return "";
      }

      return `<${tagName}>`;
    },
  );
};

const cleanMentions = (entry) => {
  // Proxy Avatar URL
  if (entry.author && entry.author.photo) {
    // We proxy everything fetched dynamically to ensure availability and privacy
    // Using relative path to the function itself
    entry.author.photo = `/.netlify/functions/webmentions?avatar=${encodeURIComponent(entry.author.photo)}`;
  }

  if (!entry.content) {
    entry.content = { value: "" };
    return entry;
  }

  const { html, text } = entry.content;

  if (html) {
    entry.content.value =
      html.length > 2000
        ? `mentioned this in <a href="${entry["wm-source"]}">${entry["wm-source"]}</a>`
        : simpleSanitize(html);
  } else {
    entry.content.value = simpleSanitize(text);
  }

  return entry;
};

const processMentions = (webmentions) => {
  const allowedTypes = ["in-reply-to", "mention-of", "like-of", "repost-of"];

  const checkRequiredFields = (entry) => {
    const { author } = entry;
    return !!author && !!author.name;
  };

  return webmentions
    .filter((entry) => allowedTypes.includes(entry["wm-property"]))
    .filter(checkRequiredFields)
    .sort((a, b) => {
      const dateA = new Date(a.published || a["wm-received"]);
      const dateB = new Date(b.published || b["wm-received"]);
      return dateA - dateB;
    })
    .map(cleanMentions);
};

export default async (req, context) => {
  const url = new URL(req.url);

  // --- AVATAR PROXY HANDLER ---
  const avatarUrl = url.searchParams.get("avatar");
  if (avatarUrl) {
    try {
      // Security: Validate URL and Protocol
      const avatarObj = new URL(avatarUrl);
      if (!["http:", "https:"].includes(avatarObj.protocol)) {
        return new Response("Invalid protocol", { status: 400 });
      }

      const imageRes = await fetch(avatarUrl);
      if (!imageRes.ok) {
        return new Response("Image not found", { status: 404 });
      }

      const contentType = imageRes.headers.get("content-type") || "image/jpeg";
      const buffer = await imageRes.arrayBuffer();

      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          // Cache aggressively (7 days)
          "Cache-Control": "public, s-maxage=604800, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      console.error("Error proxying avatar:", err);
      return new Response("Error fetching image", { status: 502 });
    }
  }

  // --- WEBMENTIONS FETCH HANDLER ---
  const path = url.searchParams.get("path");

  if (!path) {
    return new Response("Missing path parameter", { status: 400 });
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const target = `https://${BASE_URL}${cleanPath}`;

  const webmentionUrl = `${API_ORIGIN}?per-page=1000&target=${encodeURIComponent(target)}`;

  try {
    const response = await fetch(webmentionUrl);
    if (!response.ok) {
      return new Response(
        `Error fetching webmentions: ${response.statusText}`,
        {
          status: response.status,
        },
      );
    }
    const feed = await response.json();
    const children = feed.children || [];
    const processed = processMentions(children);

    return new Response(JSON.stringify(processed), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Error in webmentions function:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
