import { HttpClient } from "../../utils/fetch-base.ts";
import { onColor } from "../../utils/motif.ts";
import { MOTIF_SHA } from "../../_config/metadata.ts";

const SPEC_URL =
  `https://cdn.jsdelivr.net/gh/egecelikci/motif@${MOTIF_SHA}/spec/palette.json`;

interface Spec {
  readonly semantics: Readonly<Record<string, string>>;
  readonly accessibility: {
    readonly standard: string;
    readonly normalText: number;
    readonly largeTextAndUI: number;
  };
  readonly light: Readonly<Record<string, string>>;
  readonly dark: Readonly<Record<string, string>>;
}

const httpClient = new HttpClient({
  userAgent: "ege.celikci.me/1.0",
  cacheName: "motif-spec-cache",
});

/** Pinned commit, so the Web Cache entry never goes stale; a cold build without network fails loudly rather than rendering a half-empty style guide. */
const spec = await httpClient.fetch<Spec>(SPEC_URL);
if (!spec) throw new Error(`motif: failed to load ${SPEC_URL}`);

/**
 * One row per token, both schemes side by side: the function it serves (from `semantics`, in spec order) plus each scheme's value. A scheme that does not define a token keeps a gap instead of guessing.
 */
const usage = [
  ...new Set([...Object.keys(spec.light), ...Object.keys(spec.dark)]),
]
  .map((token) => ({
    token,
    role: spec.semantics[token] ?? "",
    light: spec.light[token],
    dark: spec.dark[token],
  }));

/** The custom properties a panel needs to paint its own frame and title. */
const panelVars = (mode: Record<string, string>) =>
  [
    `--color-bg: ${mode.bg}`,
    `--color-surface: ${mode.surface}`,
    `--color-text: ${mode.text}`,
    `--color-border: ${mode.border}`,
    `--color-border-subtle: color-mix(in srgb, ${mode.border}, transparent 60%)`,
  ].join("; ");

/**
 * One entry per scheme, keyed so the page decides order and framing. Every token of the scheme is included, in spec order, with the text colour that reads best on it. Markup lives in `src/_components/features/Palette.vto`.
 */
const schemes = (["light", "dark"] as const).map((scheme) => {
  const tokens = usage
    .filter((row) => row[scheme])
    .map((row) => {
      const value = row[scheme]!;
      return {
        token: row.token,
        role: row.role,
        value,
        text: onColor(
          value,
          spec.light.text,
          spec.dark.text,
          spec.accessibility.normalText,
        ),
      };
    });

  return {
    scheme,
    count: tokens.length,
    vars: panelVars(spec[scheme]),
    tokens,
  };
});

export default {
  accessibility: spec.accessibility,
  schemes,
};
