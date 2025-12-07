import { JSDOM, } from "jsdom";
import { memoize, random, } from "lodash-es";
import { DateTime, } from "luxon";
import sanitizeHTML from "sanitize-html";
import { extractNoteGridData, } from "./noteGridDataExtractor.ts";

const TIMEZONE = "Europe/Istanbul";

const getNoteGridData = memoize(extractNoteGridData,);

// Helper interfaces
interface Post {
  inputPath: string;
  [key: string]: unknown; // Changed from any
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
  [key: string]: unknown; // Changed from any
}

export default {
  getNoteGridData,

  readableDate: function(date: Date, format?: string,): string {
    // default to Europe/Vienna Timezone
    const dt = DateTime.fromJSDate(date, { zone: TIMEZONE, },);
    if (!format) {
      format = dt.hour + dt.minute > 0 ? "dd LLL yyyy - HH:mm" : "dd LLL yyyy";
    }
    return dt.toFormat(format,);
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

  stringify: function(json: unknown,): string { // Changed from any
    return JSON.stringify(json,);
  },

  excludePost: function(allPosts: Post[], currentPost: Post,): Post[] {
    return allPosts.filter((post,) => post.inputPath !== currentPost.inputPath);
  },

  currentPage: function(allPages: Post[], currentPage: Post,): Post | null {
    const matches = allPages.filter(
      (page,) => page.inputPath === currentPage.inputPath,
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

    // Create a virtual DOM from the content
    const dom = new JSDOM(content,);
    const document = dom.window.document;
    const body = document.body;

    let charsCount = 0;
    let truncated = false;
    const resultFragment = document.createDocumentFragment();

    function processNode(node: Node, targetParent: Node,) {
      if (truncated) return;

      if (node.nodeType === document.TEXT_NODE) {
        const text = node.textContent || "";
        const remainingLength = maxLength - charsCount;

        if (text.length <= remainingLength) {
          targetParent.appendChild(node.cloneNode(true,),);
          charsCount += text.length;
        } else {
          // Truncate text node and mark as truncated
          const truncatedText = text.substring(0, remainingLength,);
          targetParent.appendChild(
            document.createTextNode(truncatedText + "…",),
          );
          truncated = true;
        }
      } else if (node.nodeType === document.ELEMENT_NODE) {
        // Clone element (without children initially)
        const clonedElement = node.cloneNode(false,);
        targetParent.appendChild(clonedElement,);

        // Recursively process children
        for (const child of Array.from(node.childNodes,)) { // Added Array.from
          processNode(child as Node, clonedElement,);
          if (truncated) break; // Stop if truncation occurred within children
        }
      }
    }

    // Process top-level nodes of the body
    for (const node of Array.from(body.childNodes,)) { // Added Array.from
      if (truncated) break;
      processNode(node as Node, resultFragment,);
    }

    // If the original content's text content is already <= maxLength, return original.
    if ((body.textContent || "").length <= maxLength) {
      return content;
    }

    // Serialize the fragment back to HTML using a temporary container
    const tempContainer = document.createElement("div",);
    tempContainer.appendChild(resultFragment,);
    return tempContainer.innerHTML;
  },

  randomItem: function<T,>(arr: T[],): T {
    return arr[random(arr.length - 1,)];
  },

  shuffle: function<T,>(arr: T[] | null | undefined,): T[] {
    if (!arr) return [];
    const newArr = [...arr,]; // Clone to avoid mutating original
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

  findById: function<T extends { id: unknown; },>( // Changed any
    array: T[],
    id: unknown, // Changed any
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
    const urls = ["https://ege.celikci.me",];
    const authorUrl = webmention && webmention.author
      ? webmention.author.url
      : undefined;
    // check if a given URL is part of this site.
    return !!(authorUrl && urls.includes(authorUrl,));
  },

  webmentionsByUrl: function(
    webmentions: Webmention[] | undefined,
    url: string,
  ): Webmention[] {
    if (!webmentions) return [];
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
          // really long html mentions, usually newsletters or compilations
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
      .filter((entry,) => entry["wm-target"] === url)
      .filter((entry,) => allowedTypes.includes(entry["wm-property"] || "",))
      .filter(checkRequiredFields,)
      .sort(orderByDate,)
      .map(clean,);
  },

  webmentionCountByType: function(
    webmentions: Webmention[] | undefined,
    url: string,
    ...types: string[]
  ): string {
    if (!webmentions) return "0";
    const isUrlMatch = (entry: Webmention,) => entry["wm-target"] === url;

    return String(
      webmentions
        .filter(isUrlMatch,)
        .filter((entry,) => types.includes(entry["wm-property"] || "",)).length,
    );
  },
};
