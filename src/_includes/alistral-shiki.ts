import type { LanguageRegistration, ShikiTransformer } from "shiki";

// --- 1. Custom Language Definitions ---
export const alistralLangs: LanguageRegistration[] = [
  {
    name: "alistral",
    scopeName: "source.alistral",
    patterns: [
      { include: "#comment" },
      { include: "#table-border" },
      { include: "#arrow-up" },
      { include: "#arrow-down" },
      { include: "#dim-part" },
      { include: "#by-keyword" },
      { include: "#number" },
    ],
    repository: {
      comment: {
        match:
          "^(?:In \\d+, you:|Here's.*|Welcome.*|Please wait.*|\\[Press enter.*)",
        name: "comment.block.alistral",
      },
      "table-border": {
        match: "[┌─┬┐│┆╞═╪╡└┴┘]",
        name: "punctuation.definition.table.alistral",
      },
      "arrow-up": { match: "▲", name: "keyword.operator.arrow-up.alistral" },
      "arrow-down": {
        match: "▼",
        name: "keyword.operator.arrow-down.alistral",
      },
      "dim-part": { match: "≪[^│┆\\n]*", name: "comment.dim.alistral" },
      "by-keyword": { match: "\\bby\\b", name: "keyword.other.by.alistral" },
      number: {
        match: "\\b\\d+(?:[hms]|days?|months?)?\\b",
        name: "constant.numeric.alistral",
      },
    },
  },
  {
    name: "alistral-recordings",
    scopeName: "source.alistral.recordings",
    patterns: [{ include: "#title" }, { include: "#artist" }, {
      include: "source.alistral",
    }],
    repository: {
      artist: {
        match: "(?<=by\\s+)[^│\\n]+?(?=\\s*(?:│|$))",
        name: "entity.name.tag.artist.alistral",
      },
      title: {
        match: "(?<=┆\\s+)[^│┆\\n]+?(?=\\s+by\\b)",
        name: "entity.name.function.title.alistral",
      },
    },
  },
  {
    name: "alistral-releases",
    scopeName: "source.alistral.releases",
    patterns: [{ include: "#title" }, { include: "#artist" }, {
      include: "source.alistral",
    }],
    repository: {
      artist: {
        match: "(?<=by\\s+)[^│\\n]+?(?=\\s*(?:│|$))",
        name: "entity.name.tag.artist.alistral",
      },
      title: {
        match: "(?<=┆\\s+)[^│┆\\n]+?(?=\\s+by\\b)",
        name: "string.quoted.title.alistral",
      },
    },
  },
  {
    name: "alistral-artists",
    scopeName: "source.alistral.artists",
    patterns: [{ include: "#title" }, { include: "source.alistral" }],
    repository: {
      title: {
        match: "(?<=┆\\s+)(?![^┆\\n]*≪)[^│┆\\n]+?(?=\\s*(?:│|$))",
        name: "entity.name.tag.artist.alistral",
      },
    },
  },
  {
    name: "alistral-labels",
    scopeName: "source.alistral.labels",
    patterns: [{ include: "#title" }, { include: "source.alistral" }],
    repository: {
      title: {
        match: "(?<=┆\\s+)(?![^┆\\n]*≪)[^│┆\\n]+?(?=\\s*(?:│|$))",
        name: "variable.other.label.alistral",
      },
    },
  },
];

// --- 2. Custom Colors to Inject ---
const alistralColors = [
  {
    scope: "keyword.operator.arrow-up.alistral",
    settings: { foreground: "#12c679", fontStyle: "bold" },
  },
  {
    scope: "keyword.operator.arrow-down.alistral",
    settings: { foreground: "#ef4444", fontStyle: "bold" },
  },
  { scope: "comment.dim.alistral", settings: { foreground: "#646464" } },
  {
    scope: "entity.name.function.title.alistral",
    settings: { foreground: "#00d672" },
  },
  {
    scope: "entity.name.tag.artist.alistral",
    settings: { foreground: "#14a3f9" },
  },
  {
    scope: "string.quoted.title.alistral",
    settings: { foreground: "#fead4b" },
  },
  {
    scope: "variable.other.label.alistral",
    settings: { foreground: "#d600d6" },
  },
];

// --- 3. Theme Loader Helper ---
// This takes a base theme and injects your custom colors
export async function loadAlistralTheme(themeName: string) {
  const themeModule = await import(`@shikijs/themes/${themeName}`);
  const theme = themeModule.default;
  return {
    ...theme,
    tokenColors: [...(theme.tokenColors || []), ...alistralColors],
  };
}

// --- 4. Transformer ---
export function transformerFilename(): ShikiTransformer {
  return {
    name: "custom:filename",
    preprocess(code, options) {
      // Rehype-shiki passes the raw meta string in options.meta.__raw usually
      const meta = options.meta?.__raw;
      if (!meta) return;

      const match = meta.match(/(?:filename|title)="([^"]+)"/);
      if (match) {
        (options.meta as any)._filename = match[1];
      }
    },
    root(node) {
      const filename = (this.options.meta as any)?._filename;
      if (!filename) return;

      return {
        type: "element",
        tagName: "figure",
        properties: { class: "code-block" },
        children: [
          {
            type: "element",
            tagName: "figcaption",
            properties: { class: "code-header" },
            children: [{ type: "text", value: filename }],
          },
          node, // The original code block
        ],
      } as any;
    },
  };
}
