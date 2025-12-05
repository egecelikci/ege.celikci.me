import { DateTime } from "luxon";
import sanitizeHTML from "sanitize-html";
import random from "lodash/random.js";
import memoize from "lodash/memoize.js";
import { extractNoteGridData } from "./noteGridDataExtractor.js";
import { JSDOM } from "jsdom"; // Import JSDOM for HTML-aware truncation

const TIMEZONE = "Europe/Istanbul";

const getNoteGridData = memoize(extractNoteGridData);

export default {
  getNoteGridData,

  readableDate: function (date, format) {
    // default to Europe/Vienna Timezone
    const dt = DateTime.fromJSDate(date, { zone: TIMEZONE });
    if (!format) {
      format = dt.hour + dt.minute > 0 ? "dd LLL yyyy - HH:mm" : "dd LLL yyyy";
    }
    return dt.toFormat(format);
  },

  dateToFormat: function (date, format) {
    return DateTime.fromJSDate(date, { zone: TIMEZONE }).toFormat(
      String(format),
    );
  },

  dateToISO: function (date) {
    return DateTime.fromJSDate(date, { zone: TIMEZONE }).toISO({
      includeOffset: false,
      suppressMilliseconds: true,
    });
  },

  dateFromISO: function (timestamp) {
    return DateTime.fromISO(timestamp, { zone: TIMEZONE }).toJSDate();
  },

  humanizeNumber: function (num) {
    if (num > 999) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return num;
  },

  obfuscate: function (str) {
    const chars = [];
    for (var i = str.length - 1; i >= 0; i--) {
      chars.unshift(["&#", str[i].charCodeAt(), ";"].join(""));
    }
    return chars.join("");
  },

  slice: function (array, start, end) {
    return end ? array.slice(start, end) : array.slice(start);
  },

  stringify: function (json) {
    return JSON.stringify(json);
  },

  excludePost: function (allPosts, currentPost) {
    return allPosts.filter((post) => post.inputPath !== currentPost.inputPath);
  },

  currentPage: function (allPages, currentPage) {
    const matches = allPages.filter(
      (page) => page.inputPath === currentPage.inputPath,
    );
    if (matches && matches.length) {
      return matches[0];
    }
    return null;
  },

  excerpt: function (content, customLength) {
    if (!content) {
      return "";
    }

    const maxLength = customLength || 500; // Use custom length if provided, otherwise default to 400

    // Create a virtual DOM from the content
    const dom = new JSDOM(content);
    const document = dom.window.document;
    const body = document.body;

    let charsCount = 0;
    let truncated = false;
    const resultFragment = document.createDocumentFragment();

    function processNode(node, targetParent) {
      if (truncated) return;

      if (node.nodeType === document.TEXT_NODE) {
        const text = node.textContent;
        const remainingLength = maxLength - charsCount;

        if (text.length <= remainingLength) {
          targetParent.appendChild(node.cloneNode(true));
          charsCount += text.length;
        } else {
          // Truncate text node and mark as truncated
          const truncatedText = text.substring(0, remainingLength);
          targetParent.appendChild(
            document.createTextNode(truncatedText + "…"),
          );
          truncated = true;
        }
      } else if (node.nodeType === document.ELEMENT_NODE) {
        // Clone element (without children initially)
        const clonedElement = node.cloneNode(false);
        targetParent.appendChild(clonedElement);

        // Recursively process children
        for (const child of node.childNodes) {
          processNode(child, clonedElement);
          if (truncated) break; // Stop if truncation occurred within children
        }
      }
    }

    // Process top-level nodes of the body
    for (const node of body.childNodes) {
      if (truncated) break;
      processNode(node, resultFragment);
    }

    // If the original content's text content is already <= maxLength, return original.
    if (body.textContent.length <= maxLength) {
      return content;
    }

    // Serialize the fragment back to HTML using a temporary container
    const tempContainer = document.createElement("div");
    tempContainer.appendChild(resultFragment);
    return tempContainer.innerHTML;
  },

  randomItem: function (arr) {
    return arr[random(arr.length - 1)];
  },

  shuffle: function (arr) {
    let m = arr.length,
      t,
      i;

    while (m) {
      i = Math.floor(Math.random() * m--);
      t = arr[m];
      arr[m] = arr[i];
      arr[i] = t;
    }

    return arr;
  },

  findById: function (array, id) {
    return array.find((i) => i.id === id);
  },

  decodeBase64: function (string) {
    return atob(string);
  },

  getKeys: function (target) {
    return Object.keys(target);
  },

  filterTagList: function (tags) {
    return (tags || []).filter((tag) => ["all", "posts"].indexOf(tag) === -1);
  },

  sortAlphabetically: function (array) {
    return (array || []).sort((b, a) => b.localeCompare(a));
  },

  isOwnWebmention: function (webmention) {
    const urls = ["https://ege.celikci.me"];
    const authorUrl = webmention.author ? webmention.author.url : false;
    // check if a given URL is part of this site.
    return authorUrl && urls.includes(authorUrl);
  },

  webmentionsByUrl: function (webmentions, url) {
    const allowedTypes = ["mention-of", "in-reply-to"];
    const allowedHTML = {
      allowedTags: ["b", "i", "em", "strong", "a"],
      allowedAttributes: {
        a: ["href"],
      },
    };

    const orderByDate = (a, b) => new Date(a.published) - new Date(b.published);

    const checkRequiredFields = (entry) => {
      const { author, published, content } = entry;
      return !!author && !!author.name && !!published && !!content;
    };

    const clean = (entry) => {
      const { html, text } = entry.content;

      if (html) {
        // really long html mentions, usually newsletters or compilations
        entry.content.value =
          html.length > 2000
            ? `mentioned this in <a href="${entry["wm-source"]}">${entry["wm-source"]}</a>`
            : sanitizeHTML(html, allowedHTML);
      } else {
        entry.content.value = sanitizeHTML(text, allowedHTML);
      }

      return entry;
    };

    return webmentions
      .filter((entry) => entry["wm-target"] === url)
      .filter((entry) => allowedTypes.includes(entry["wm-property"]))
      .filter(checkRequiredFields)
      .sort(orderByDate)
      .map(clean);
  },

  webmentionCountByType: function (webmentions, url, ...types) {
    const isUrlMatch = (entry) => entry["wm-target"] === url;

    return String(
      webmentions
        .filter(isUrlMatch)
        .filter((entry) => types.includes(entry["wm-property"])).length,
    );
  },
};
