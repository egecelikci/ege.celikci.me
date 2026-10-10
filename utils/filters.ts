import xss, { escapeHtml } from "xss";
import authorData from "../src/_data/author.ts";
import siteData from "../src/_data/site.ts";
import gitData from "../src/_data/git.ts";
import { getLinkInfo } from "./links.ts";
import { noteTitle as buildNoteTitle } from "./incoming.ts";
import { pageType as schemaPageType } from "./schema.ts";

const SITE_URL = siteData.url;
const OWN_URLS = [
  SITE_URL,
  authorData.social.mastodon.url,
  authorData.social.bluesky.url,
  ...authorData.links.map((l) => l.url),
].map((u) => u.replace(/\/+$/, ""));

interface Webmention {
  author?: {
    name?: string;
    type?: string;
    url?: string | null;
    photo?: string | null;
  } | null;
  published?: string | null;
  "wm-received"?: string;
  content?: {
    html?: string | null;
    text?: string | null;
    value?: string | null;
  } | null;
  "wm-target"?: string;
  "wm-property"?: string;
  "wm-source"?: string;
  url?: string | string[] | null;
  photo?: string | string[] | null;
}

export const filters = {
  /** schema.org type for the page wrapper (see utils/schema.ts). */
  pageType: (page: { url?: string; type?: string }) => schemaPageType(page),

  humanizeNumber: function (num: number): string | number {
    if (num > 999) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return num;
  },

  /**
   * Display title for a page: authored title, or `note from <date>` for untitled notes. Single source of truth shared with the incoming graph (see utils/incoming.ts noteTitle).
   */
  noteTitle: function (
    data: { title?: unknown; date?: unknown },
  ): string {
    const title = typeof data?.title === "string" ? data.title : "";
    const date = data?.date instanceof Date || typeof data?.date === "string"
      ? data.date
      : undefined;
    return buildNoteTitle(title, date);
  },

  getLinkInfo: function (type: string, url: string) {
    return getLinkInfo(type, url);
  },

  slice: function <T>(array: T[], start: number, end?: number): T[] {
    return end ? array.slice(start, end) : array.slice(start);
  },

  isOwnWebmention: function (webmention: Webmention): boolean {
    const authorUrl = webmention && webmention.author
      ? webmention.author.url?.replace(/\/+$/, "")
      : undefined;
    return !!(authorUrl && OWN_URLS.includes(authorUrl));
  },

  webmentionsByUrl: function (
    webmentions: Webmention[] | undefined,
    url: string,
    syndication?: Record<string, string>,
  ): Webmention[] {
    if (!webmentions) return [];
    const absoluteUrl = url.startsWith("http") ? url : SITE_URL + url;
    const cleanUrl = (u: string) => u.replace(/\/+$/, "");
    const targetUrl = cleanUrl(absoluteUrl);
    const allowedTypes = ["mention-of", "in-reply-to", "like-of", "repost-of"];

    const xssOptions = {
      whiteList: {
        b: [],
        i: [],
        em: [],
        strong: [],
        a: ["href"],
      },
    };

    const syndicationUrls = syndication
      ? Object.values(syndication).map(cleanUrl)
      : [];

    const orderByDate = (a: Webmention, b: Webmention) =>
      new Date(a.published || a["wm-received"] || "").getTime() -
      new Date(b.published || b["wm-received"] || "").getTime();

    const checkRequiredFields = (entry: Webmention) => {
      const { author } = entry;
      return !!author && !!author.name;
    };

    const isSyndicated = (entry: Webmention) => {
      const source = cleanUrl(entry["wm-source"] || "");
      const entryUrl = Array.isArray(entry.url)
        ? (entry.url[0] || "")
        : (entry.url || "");
      const url = cleanUrl(entryUrl);
      return syndicationUrls.includes(source) || syndicationUrls.includes(url);
    };

    const clean = (entry: Webmention) => {
      if (entry.content) {
        const { html, text } = entry.content;

        if (html) {
          if (html.length > 2000) {
            // The source URL comes from whoever sent the webmention, so it is escaped and the link still goes through xss to drop javascript: URLs.
            const source = escapeHtml(entry["wm-source"] || "");
            entry.content.value = xss(
              `mentioned this in <a href="${source}">${source}</a>`,
              xssOptions,
            );
          } else {
            entry.content.value = xss(html, xssOptions);
          }
        } else {
          entry.content.value = xss(text || "", xssOptions);
        }
      } else {
        entry.content = { value: "" };
      }

      return entry;
    };

    return webmentions
      .filter((entry) => cleanUrl(entry["wm-target"] || "") === targetUrl)
      .filter((entry) => allowedTypes.includes(entry["wm-property"] || ""))
      .filter((entry) => !isSyndicated(entry))
      .filter((entry) => !filters.isOwnWebmention(entry))
      .filter(checkRequiredFields)
      .map(clean)
      .sort(orderByDate);
  },

  resolveComp: (compPath: string, compRoot: Record<string, unknown>) => {
    return compPath.split(".").reduce(
      (obj, part) => obj?.[part] as Record<string, unknown>,
      compRoot,
    );
  },

  resolveSourceUrl: function (path: string): string {
    const repoPath = path.startsWith("/") ? path.slice(1) : path;
    return `https://${gitData.host}/${authorData.username}/${siteData.host}/src/branch/main/${repoPath}`;
  },
};
