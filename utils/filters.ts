import {
  DOMParser,
  Element,
  Node,
} from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import * as path from "jsr:@std/path";
import { random, } from "npm:lodash-es@4.17.22";
import { DateTime, } from "npm:luxon@^3.7.2";
import sanitizeHTML from "npm:sanitize-html@2.12.1";

import siteData from "../src/_data/site.ts";

export interface NoteGridData {
  hasImage: boolean;
  src?: string | null;
  srcset?: string | null;
  alt?: string | null;
  caption?: string;
  title?: string;
  hasMultipleImages?: boolean;
}

const TIMEZONE = "Europe/Istanbul";

// Helper interfaces
interface Post {
  data: {
    url?: string;
    [key: string]: unknown;
  };
  src: {
    path: string;
  };
  [key: string]: unknown;
}

interface Webmention {
  author?: {
    name?: string;
    url?: string;
    photo?: string;
  };
  published?: string;
  "wm-received"?: string;
  content?: {
    html?: string;
    text?: string;
    value?: string;
  };
  "wm-target"?: string;
  "wm-property"?: string;
  "wm-source"?: string;
  [key: string]: unknown;
}

export const filters = {
  dirname: function(filePath: string,): string {
    return path.dirname(filePath,);
  },

  dateToFormat: function(date: Date, format: string,): string {
    return DateTime.fromJSDate(date, { zone: TIMEZONE, },).toFormat(
      String(format,),
    );
  },

  dateToISO: function(date: Date,): string | null {
    return DateTime.fromJSDate(date, { zone: TIMEZONE, },).toISO({
      includeOffset: false,
      suppressMilliseconds: true,
    },);
  },

  dateFromISO: function(timestamp: string,): Date {
    return DateTime.fromISO(timestamp, { zone: TIMEZONE, },).toJSDate();
  },

  humanizeNumber: function(num: number,): string | number {
    if (num > 999) {
      return (num / 1000).toFixed(1,).replace(/\.0$/, "",) + "K";
    }
    return num;
  },
  extractImages: (content: string,) => {
    if (!content) return [];

    const imgRegex = /<img[^>]+src="([^">]+)"[^>]*(?:alt="([^">]*)")?[^>]*>/gi;
    const images = [];
    let match;

    while ((match = imgRegex.exec(content,)) !== null) {
      images.push({
        src: match[1],
        alt: match[2] || "",
      },);
    }

    return images;
  },

  // Get first image from content (for cover)
  getCoverImage: (content: string,) => {
    const images = filters.extractImages(content,);
    return images.length > 0 ? images[0] : null;
  },

  // Check if content has images
  hasImages: (content: string,) => {
    return filters.extractImages(content,).length > 0;
  },

  // Count images in content
  imageCount: (content: string,) => {
    return filters.extractImages(content,).length;
  },

  obfuscate: function(str: string,): string {
    const chars: string[] = [];
    for (let i = str.length - 1; i >= 0; i--) {
      chars.unshift(["&#", str[i].charCodeAt(0,).toString(), ";",].join("",),);
    }
    return chars.join("",);
  },

  slice: function<T,>(array: T[], start: number, end?: number,): T[] {
    return end ? array.slice(start, end,) : array.slice(start,);
  },

  stringify: function(json: unknown,): string {
    return JSON.stringify(json,);
  },

  excludePost: function(allPosts: Post[], currentPost: Post,): Post[] {
    return allPosts.filter((post,) => post.src.path !== currentPost.src.path);
  },

  currentPage: function(allPages: Post[], currentPage: Post,): Post | null {
    const matches = allPages.filter(
      (page,) => page.src.path === currentPage.src.path,
    );
    if (matches && matches.length) {
      return matches[0];
    }
    return null;
  },

  excerpt: function(content: string, customLength?: number,): string {
    if (!content) {
      return "";
    }

    const maxLength = customLength || 500;

    // Use deno-dom instead of JSDOM
    const doc = new DOMParser().parseFromString(content, "text/html",);
    if (!doc) return "";

    // 1. Try to find the specific content container first
    // This avoids indexing site navigation, headers, footers, etc.
    let root: Node = doc.body;
    const contentContainer = doc.querySelector(".e-content",)
      || doc.querySelector(".note__content",);
    if (contentContainer) {
      root = contentContainer;
    }

    let charsCount = 0;
    let truncated = false;

    // We create a temporary body to hold our result
    const resultWrapper = doc.createElement("div",);

    // List of tags to strictly ignore (content and all)
    const ignoredTags = new Set([
      "SCRIPT",
      "STYLE",
      "SVG",
      "NAV",
      "HEADER",
      "FOOTER",
      "METADATA",
    ],);

    function processNode(node: Node, targetParent: Node,) {
      if (truncated) return;

      // SKIP ignored tags
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = (node as Element).tagName?.toUpperCase();
        if (tagName && ignoredTags.has(tagName,)) return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        // Collapse whitespace to single space to avoid layout weirdness
        const cleanText = text.replace(/\s+/g, " ",);
        if (!cleanText.trim()) return; // Skip empty whitespace nodes

        const remainingLength = maxLength - charsCount;

        if (cleanText.length <= remainingLength) {
          // We clone the node but with clean text?
          // Deno DOM might not support setting textContent easily on cloned node in this context,
          // so we create a new text node.
          targetParent.appendChild(doc!.createTextNode(cleanText,),);
          charsCount += cleanText.length;
        } else {
          // Truncate text node and mark as truncated
          const truncatedText = cleanText.substring(0, remainingLength,);
          targetParent.appendChild(doc!.createTextNode(truncatedText + "…",),);
          truncated = true;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Clone element (without children initially)
        const clonedElement = (node as Element).cloneNode(false,);
        targetParent.appendChild(clonedElement,);

        // Recursively process children
        for (const child of Array.from(node.childNodes,)) {
          processNode(child, clonedElement,);
          if (truncated) break;
        }
      }
    }

    // Process top-level nodes of the chosen root
    for (const node of Array.from(root.childNodes,)) {
      if (truncated) break;
      processNode(node, resultWrapper,);
    }

    return resultWrapper.innerHTML;
  },

  randomItem: function<T,>(arr: T[],): T {
    return arr[random(arr.length - 1,)];
  },

  shuffle: function<T,>(arr: T[] | null | undefined,): T[] {
    if (!arr) return [];
    const newArr = [...arr,];
    let m = newArr.length,
      t,
      i;

    while (m) {
      i = Math.floor(Math.random() * m--,);
      t = newArr[m];
      newArr[m] = newArr[i];
      newArr[i] = t;
    }

    return newArr;
  },

  findById: function<T extends { id: unknown; },>(
    array: T[],
    id: unknown,
  ): T | undefined {
    return array.find((i,) => i.id === id);
  },

  decodeBase64: function(string: string,): string {
    return atob(string,);
  },

  getKeys: function(target: object,): string[] {
    return Object.keys(target,);
  },

  filterTagList: function(tags: string[] | undefined,): string[] {
    return (tags || []).filter((tag,) =>
      ["all", "posts",].indexOf(tag,) === -1
    );
  },

  sortAlphabetically: function(array: string[],): string[] {
    return (array || []).sort((b, a,) => b.localeCompare(a,));
  },

  isOwnWebmention: function(webmention: Webmention,): boolean {
    const urls = [siteData.url,];
    const authorUrl = webmention && webmention.author
      ? webmention.author.url
      : undefined;
    return !!(authorUrl && urls.includes(authorUrl,));
  },

  webmentionsByUrl: function(
    webmentions: Webmention[] | undefined,
    url: string,
  ): Webmention[] {
    if (!webmentions) return [];
    const absoluteUrl = url.startsWith("http",) ? url : siteData.url + url;
    const cleanUrl = (u: string,) => u.replace(/\/+$/, "",);
    const targetUrl = cleanUrl(absoluteUrl,);
    const allowedTypes = ["mention-of", "in-reply-to", "like-of", "repost-of",];
    const allowedHTML = {
      allowedTags: ["b", "i", "em", "strong", "a",],
      allowedAttributes: {
        a: ["href",],
      },
    };

    const orderByDate = (a: Webmention, b: Webmention,) =>
      new Date(a.published || a["wm-received"] || "",).getTime()
      - new Date(b.published || b["wm-received"] || "",).getTime();

    const checkRequiredFields = (entry: Webmention,) => {
      const { author, } = entry;
      return !!author && !!author.name;
    };

    const clean = (entry: Webmention,) => {
      if (entry.content) {
        const { html, text, } = entry.content;

        if (html) {
          if (html.length > 2000) {
            entry.content.value = `mentioned this in <a href="${
              entry["wm-source"]
            }">${entry["wm-source"]}</a>`;
          } else {
            entry.content.value = sanitizeHTML(html, allowedHTML,);
          }
        } else {
          entry.content.value = sanitizeHTML(text || "", allowedHTML,);
        }
      } else {
        entry.content = { value: "", };
      }

      return entry;
    };

    return webmentions
      .filter((entry,) => cleanUrl(entry["wm-target"] || "",) === targetUrl)
      .filter((entry,) => allowedTypes.includes(entry["wm-property"] || "",))
      .filter(checkRequiredFields,)
      // .sort(orderByDate) // TypeScript hatası alırsanız bunu map'ten sonraya alabilirsiniz veya tip tanımlarını düzeltin
      .map(clean,)
      .sort(orderByDate,);
  },

  // src/utils/filters.ts

  webmentionCountByType: function(
    webmentions: Webmention[] | undefined,
    url: string,
    ...types: string[]
  ): string {
    if (!webmentions) return "0";

    const absoluteUrl = url.startsWith("http",) ? url : siteData.url + url;
    const cleanUrl = (u: string,) => u.replace(/\/+$/, "",);
    const targetUrl = cleanUrl(absoluteUrl,);

    const isUrlMatch = (entry: Webmention,) =>
      cleanUrl(entry["wm-target"] || "",) === targetUrl;

    return String(
      webmentions
        .filter(isUrlMatch,)
        .filter((entry,) => types.includes(entry["wm-property"] || "",)).length,
    );
  },
};
