/**
 * Alistral Syntax Highlighting for PrismJS
 * Based on analysis of https://github.com/RustyNova016/Alistral
 */

export default function(
  // deno-lint-ignore no-explicit-any
  Prism: any,
) {
  Prism.languages.alistral = {
    comment: {
      pattern:
        /^(?:In \d+, you:|Here's.*|Welcome.*|Please wait.*|\[Press enter.*)/m,
      alias: "comment",
    },
    "table-border": {
      pattern: /[┌─┬┐│┆╞═╪╡└┴┘]/,
      alias: "punctuation",
    },
    "arrow-up": {
      pattern: /▲/,
      alias: "alistral-arrow-up",
    },
    "arrow-down": {
      pattern: /▼/,
      alias: "alistral-arrow-down",
    },
    "dim-part": {
      pattern: /≪[^│┆\n]*/,
      alias: "alistral-dim",
    },
    "by-keyword": {
      pattern: /\bby\b/,
    },
    number: {
      pattern: /\b\d+(?:[hms]|days?|months?)?\b/,
    },
  };

  Prism.languages["alistral-recordings"] = Prism.languages.extend(
    "alistral",
    {},
  );

  Prism.languages.insertBefore("alistral-recordings", "table-border", {
    artist: {
      pattern: /(?<=by\s+)[^│\n]+?(?=\s*(?:│|$))/,
      alias: "alistral-blue",
    },
    title: {
      pattern: /(?<=┆\s+)[^│┆\n]+?(?=\s+by\b)/,
      alias: "alistral-title",
    },
  },);

  Prism.languages["alistral-releases"] = Prism.languages.extend(
    "alistral",
    {},
  );

  Prism.languages.insertBefore("alistral-releases", "table-border", {
    artist: {
      pattern: /(?<=by\s+)[^│\n]+?(?=\s*(?:│|$))/,
      alias: "alistral-blue",
    },
    title: {
      pattern: /(?<=┆\s+)[^│┆\n]+?(?=\s+by\b)/,
      alias: "alistral-orange",
    },
  },);

  Prism.languages["alistral-artists"] = Prism.languages.extend("alistral", {},);

  Prism.languages.insertBefore("alistral-artists", "table-border", {
    title: {
      pattern: /(?<=┆\s+)(?![^┆\n]*≪)[^│┆\n]+?(?=\s*(?:│|$))/,
      alias: "alistral-blue",
    },
  },);

  Prism.languages["alistral-labels"] = Prism.languages.extend("alistral", {},);

  Prism.languages.insertBefore("alistral-labels", "table-border", {
    title: {
      pattern: /(?<=┆\s+)(?![^┆\n]*≪)[^│┆\n]+?(?=\s*(?:│|$))/,
      alias: "alistral-purple",
    },
  },);
}
