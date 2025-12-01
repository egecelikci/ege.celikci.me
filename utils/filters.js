import { DateTime } from "luxon";
import random from "lodash/random.js";
import memoize from "lodash/memoize.js";
import { extractNoteGridData } from "./noteGridDataExtractor.js";

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

  excerpt: function (content) {
    if (!content) {
      return;
    }

    const excerptMinimumLength = 80;
    const firstParagraphEnd = content.indexOf("</p>");

    if (
      firstParagraphEnd !== -1 &&
      firstParagraphEnd + 4 >= excerptMinimumLength
    ) {
      return content.substring(0, firstParagraphEnd + 4);
    } else if (content.length <= excerptMinimumLength) {
      return content;
    } else {
      // If no paragraph found or it's too short, try to find a reasonable cutoff
      let excerpt = content.substring(0, excerptMinimumLength);
      // Try to end on a word boundary
      const lastSpace = excerpt.lastIndexOf(" ");
      if (lastSpace !== -1) {
        excerpt = excerpt.substring(0, lastSpace);
      }
      return excerpt + "…"; // Add ellipsis for truncated content
    }
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
};
