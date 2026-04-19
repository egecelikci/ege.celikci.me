/**
 * _config/filters.ts
 * Central filter registration.
 */

import theme from "../src/_data/theme.ts";
import { filters, } from "../utils/filters.ts";

export default function() {
  return (site: Lume.Site,) => {
    // 1. Register all standard filters
    for (const [name, fn,] of Object.entries(filters,)) {
      console.log(`[config] Registering filter: ${name}`,);
      site.filter(name, fn as (value: unknown, ...args: unknown[]) => unknown,);
    }

    // 2. Register theme-specific class merger
    site.filter("cx", theme.cx,);
  };
}
