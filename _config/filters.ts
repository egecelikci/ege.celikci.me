/**
 * Central filter registration.
 *
 * The filter implementations live in `lib/template-filters.ts` and never touch
 * `src/_data` themselves; the metadata they need is handed over here, which is
 * the one place that is allowed to know about both.

import author from "../src/_data/author.ts";
import git from "../src/_data/git.ts";
import site from "../src/_data/site.ts";
 */

import { createFilters } from "../lib/template-filters.ts";
import author from "../src/_data/author.ts";
import git from "../src/_data/git.ts";
import site from "../src/_data/site.ts";

/** The filter set, shared with the preprocessors that need the same predicates. */
export const filters = createFilters({ site, author, git });

export default function () {
  return (lumeSite: Lume.Site) => {
    for (const [name, fn] of Object.entries(filters)) {
      lumeSite.filter(
        name,
        fn as (value: unknown, ...args: unknown[]) => unknown,
      );
    }
  };
}
