// deno-lint-ignore-file no-explicit-any
import { Callout, Icon, renderTags, } from "./components.ts";

export const syncShortcodes: Record<string, any> = {
  icon: Icon,
  renderTags: renderTags,
};

export const pairedShortcodes: Record<string, any> = {
  callout: Callout,
};
export const asyncShortcodes: Record<string, any> = {};
