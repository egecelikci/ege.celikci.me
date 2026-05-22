/**
 * _config/filters.ts
 * Central filter registration.
 */

import { filters } from "../utils/filters.ts";

export default function () {
  return (site: Lume.Site) => {
    // 1. Register all standard filters
    for (const [name, fn] of Object.entries(filters)) {
      site.filter(name, fn as (value: unknown, ...args: unknown[]) => unknown);
    }
  };
}
