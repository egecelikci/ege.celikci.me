import { HttpClient } from "../../utils/fetch-base.ts";
import { onColor } from "../../utils/motif.ts";
import { MOTIF_SHA } from "../../_config/metadata.ts";

const SPEC_URL =
  `https://cdn.jsdelivr.net/gh/egecelikci/motif@${MOTIF_SHA}/spec/palette.json`;

type Scheme = "light" | "dark";

type Tokens = Readonly<Record<string, string>>;

interface Spec {
  readonly semantics: Readonly<Record<string, string>>;
  readonly accessibility: {
    readonly standard: string;
    readonly normalText: number;
    readonly largeTextAndUI: number;
  };
  readonly light: Tokens;
  readonly dark: Tokens;
  readonly hues: Readonly<Record<Scheme, Tokens>>;
  readonly terminal: Readonly<Record<Scheme, Tokens>>;
  readonly status: Readonly<Record<string, string>>;
}

/** A set of tokens: how to read it for a scheme, and the name `semantics` describes it under. */
interface Group {
  readonly name: string;
  readonly pick: (scheme: Scheme) => Tokens;
}

const httpClient = new HttpClient({
  userAgent: "ege.celikci.me/1.0",
  cacheName: "motif-spec-cache",
});

/** Pinned commit, so the Web Cache entry never goes stale; a cold build without network fails loudly rather than rendering a half-empty style guide. */
const spec = await httpClient.fetch<Spec>(SPEC_URL);
if (!spec) throw new Error(`motif: failed to load ${SPEC_URL}`);

/**
 * The sets that are worth one row per token, in spec order. `base` is the flat token list every target ships; `hues` and `terminal` live one level down, per scheme, and are described as a whole rather than token by token.
 */
const rowGroups: readonly Group[] = [
  { name: "base", pick: (scheme) => spec[scheme] },
  { name: "hues", pick: (scheme) => spec.hues[scheme] },
];

/** The ANSI slots, which the page lays out the way a terminal palette is normally read instead of as rows. */
const terminalGroup: Group = {
  name: "terminal",
  pick: (scheme) => spec.terminal[scheme],
};

/** The custom properties a panel needs to paint its own frame and title. */
const panelVars = (mode: Tokens) =>
  [
    `--color-bg: ${mode.bg}`,
    `--color-surface: ${mode.surface}`,
    `--color-text: ${mode.text}`,
    `--color-border: ${mode.border}`,
    `--color-border-subtle: color-mix(in srgb, ${mode.border}, transparent 60%)`,
  ].join("; ");

/** Every token of a set, with the text colour that reads best on it. A set with no `semantics` entry of its own falls back to describing each token. */
const section = (group: Group, scheme: Scheme) => ({
  group: group.name,
  role: spec.semantics[group.name] ?? "",
  tokens: Object.entries(group.pick(scheme)).map(([token, value]) => ({
    token,
    role: spec.semantics[token] ?? "",
    value,
    text: onColor(
      value,
      spec.light.text,
      spec.dark.text,
      spec.accessibility.normalText,
    ),
  })),
});

/**
 * One entry per scheme, keyed so the page decides order and framing. Markup lives in `src/_components/features/Palette.vto`.
 */
const build = (scheme: Scheme) => {
  const rows = rowGroups.map((group) => section(group, scheme));
  const terminal = section(terminalGroup, scheme);

  return {
    scheme,
    count: [...rows, terminal].reduce(
      (total, set) => total + set.tokens.length,
      0,
    ),
    vars: panelVars(spec[scheme]),
    /** The panel has to read while closed, so the strip stops at the hues: the brights are derived from them. */
    preview: rows.flatMap((set) => set.tokens),
    rows,
    terminal,
  };
};

const schemes = (["light", "dark"] as const).map(build);

/** The status roles name a hue instead of carrying a colour, so the page can spell the mapping out in one sentence. */
const status = Object.entries(spec.status)
  .map(([role, hue]) => `${role} is ${hue}`)
  .join(", ");

export default {
  accessibility: spec.accessibility,
  status,
  schemes,
};
