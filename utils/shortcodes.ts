// deno-lint-ignore-file no-explicit-any
import { Callout, Icon, renderTags, themeCSS, } from "./components.ts";

export const syncShortcodes: Record<string, any> = {
  icon: Icon,
  renderTags: renderTags,
  themeCSS: themeCSS,
};

export const pairedShortcodes: Record<string, any> = {
  callout: Callout,
};
export const asyncShortcodes: Record<string, any> = {};
