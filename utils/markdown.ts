import { fromHighlighter, } from "@shikijs/markdown-it/core";
import markdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import { createHighlighterCore, } from "shiki/core";
import { createOnigurumaEngine, } from "shiki/engine/oniguruma";

import type { LanguageRegistration, ShikiTransformer, } from "shiki";
import nunjucksGrammar from "./nunjucks.tmLanguage.json" with { type: "json", };

const alistralLang = {
  name: "alistral",
  scopeName: "source.alistral",
  patterns: [
    { include: "#comment", },
    { include: "#table-border", },
    { include: "#arrow-up", },
    { include: "#arrow-down", },
    { include: "#dim-part", },
    { include: "#by-keyword", },
    { include: "#number", },
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
    "arrow-up": {
      match: "▲",
      name: "keyword.operator.arrow-up.alistral",
    },
    "arrow-down": {
      match: "▼",
      name: "keyword.operator.arrow-down.alistral",
    },
    "dim-part": {
      match: "≪[^│┆\\n]*",
      name: "comment.dim.alistral",
    },
    "by-keyword": {
      match: "\\bby\\b",
      name: "keyword.other.by.alistral",
    },
    number: {
      match: "\\b\\d+(?:[hms]|days?|months?)?\\b",
      name: "constant.numeric.alistral",
    },
  },
};

const alistralRecordingsLang = {
  name: "alistral-recordings",
  scopeName: "source.alistral.recordings",
  patterns: [
    { include: "#title", },
    { include: "#artist", },
    { include: "source.alistral", },
  ],
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
};

const alistralReleasesLang = {
  name: "alistral-releases",
  scopeName: "source.alistral.releases",
  patterns: [
    { include: "#title", },
    { include: "#artist", },
    { include: "source.alistral", },
  ],
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
};

const alistralArtistsLang = {
  name: "alistral-artists",
  scopeName: "source.alistral.artists",
  patterns: [
    { include: "#title", },
    { include: "source.alistral", },
  ],
  repository: {
    title: {
      match: "(?<=┆\\s+)(?![^┆\\n]*≪)[^│┆\\n]+?(?=\\s*(?:│|$))",
      name: "entity.name.tag.artist.alistral",
    },
  },
};

const alistralLabelsLang = {
  name: "alistral-labels",
  scopeName: "source.alistral.labels",
  patterns: [
    { include: "#title", },
    { include: "source.alistral", },
  ],
  repository: {
    title: {
      match: "(?<=┆\\s+)(?![^┆\\n]*≪)[^│┆\\n]+?(?=\\s*(?:│|$))",
      name: "variable.other.label.alistral",
    },
  },
};

const alistralLangs = [
  alistralLang,
  alistralRecordingsLang,
  alistralReleasesLang,
  alistralArtistsLang,
  alistralLabelsLang,
] as LanguageRegistration[];

function transformerFilename(): ShikiTransformer {
  return {
    name: "custom:filename",
    preprocess(code, options,) {
      const meta = options.meta?.__raw;
      if (!meta) return;

      const match = meta.match(/(?:filename|title)="([^"]+)"/,);
      if (match) {
        (options.meta as any)._filename = match[1];
      }
    },
    root(node,) {
      const filename = (this.options.meta as any)?._filename;
      if (!filename) return;

      const figure = {
        type: "element",
        tagName: "figure",
        properties: { class: "code-block", },
        children: [
          {
            type: "element",
            tagName: "figcaption",
            properties: { class: "code-header", },
            children: [{ type: "text", value: filename, },],
          },
          node,
        ],
      };

      return figure as any;
    },
  };
}

const anchorSlugify = (s: string,) =>
  encodeURIComponent(
    String(s,)
      .trim()
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=_`~()]/g, "",)
      .replace(/\s+/g, "-",),
  );

const anchorOpts = {
  placement: "after" as const,
  class: "heading-anchor",
};

const md = markdownIt({
  html: true,
  breaks: true,
  typographer: true,
},);

const alistralColors = [
  {
    scope: "keyword.operator.arrow-up.alistral",
    settings: { foreground: "#12c679", fontStyle: "bold", },
  },
  {
    scope: "keyword.operator.arrow-down.alistral",
    settings: { foreground: "#ef4444", fontStyle: "bold", },
  },
  { scope: "comment.dim.alistral", settings: { foreground: "#646464", }, },
  {
    scope: "entity.name.function.title.alistral",
    settings: { foreground: "#00d672", },
  },
  {
    scope: "entity.name.tag.artist.alistral",
    settings: { foreground: "#14a3f9", },
  },
  {
    scope: "string.quoted.title.alistral",
    settings: { foreground: "#fead4b", },
  },
  {
    scope: "variable.other.label.alistral",
    settings: { foreground: "#d600d6", },
  },
];

const highlighter = await createHighlighterCore({
  themes: [
    import("@shikijs/themes/kanagawa-lotus").then((m,) => ({
      ...m.default,
      tokenColors: [...(m.default.tokenColors || []), ...alistralColors,],
    })),
    import("@shikijs/themes/kanagawa-wave").then((m,) => ({
      ...m.default,
      tokenColors: [...(m.default.tokenColors || []), ...alistralColors,],
    })),
  ],
  langs: [
    import("@shikijs/langs/fish"),
    import("@shikijs/langs/markdown"),
    import("@shikijs/langs/json"),
    import("@shikijs/langs/javascript"),
    import("@shikijs/langs/typescript"),
    import("@shikijs/langs/bash"),
    import("@shikijs/langs/css"),
    import("@shikijs/langs/html"),
    import("@shikijs/langs/yaml"),
    {
      ...(nunjucksGrammar as any),
      name: "nunjucks",
      aliases: ["njk",],
    },
    ...alistralLangs,
  ],
  engine: createOnigurumaEngine(() => import("shiki/wasm")),
},);

md.use(
  fromHighlighter(highlighter, {
    themes: {
      light: "kanagawa-lotus",
      dark: "kanagawa-wave",
    },
    defaultColor: "light-dark()",
    transformers: [
      transformerFilename(),
    ],
  },),
);

md.use(anchor, {
  permalink: anchor.permalink.linkInsideHeader(anchorOpts,),
  slugify: anchorSlugify,
},);

export default md;
