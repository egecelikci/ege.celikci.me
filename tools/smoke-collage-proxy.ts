/**
 * Fire concurrent requests at a deployed collage proxy and check that none came back with another URL's response.
 *
 * Netlify's edge cache once answered concurrent proxy requests with each other's responses: covers came back as stats JSON, or many covers as one image. Requests one at a time never showed it, so this script sends them together, over several rounds.
 *
 * @example
 * ```sh
 * pnpm run smoke:collage                                   # production, user egecelikci
 * pnpm run smoke:collage https://deploy-preview.netlify.app someone
 * ```
 * @module
 */

import { createHash } from "node:crypto";
import { collageApiUrl } from "../lib/collage-api.ts";

const BASE = process.argv[2] ?? "https://ege.celikci.me";
const USER = process.argv[3] ?? "egecelikci";
const PERIODS = ["all_time", "year", "half_yearly", "quarter"];
const COVERS = 24;
const ROUNDS = 3;

interface Result {
  url: string;
  status: number;
  type: string;
  hash: string;
}

/** Fetch a URL and keep what the checks need. */
async function get(path: string): Promise<Result> {
  const res = await fetch(BASE + path);
  const body = Buffer.from(await res.arrayBuffer());
  return {
    url: path,
    status: res.status,
    type: res.headers.get("Content-Type") ?? "",
    hash: createHash("sha256").update(body).digest("hex"),
  };
}

/**
 * Find responses that do not belong to their URL.
 *
 * @param stats - Responses to stats URLs.
 * @param covers - Responses to distinct cover URLs.
 * @returns One line per problem; empty when every response is plausible.
 */
export function problems(stats: Result[], covers: Result[]): string[] {
  const found: string[] = [];
  for (const r of stats) {
    if (r.status === 200 && !r.type.startsWith("application/json")) {
      found.push(`stats answered as ${r.type}: ${r.url}`);
    }
  }
  const seen = new Map<string, string>();
  for (const r of covers) {
    if (r.status !== 200) continue;
    if (!r.type.startsWith("image/")) {
      found.push(`cover answered as ${r.type}: ${r.url}`);
      continue;
    }
    const first = seen.get(r.hash);
    if (first)
      found.push(`two covers with identical bytes: ${first} and ${r.url}`);
    else seen.set(r.hash, r.url);
  }
  return found;
}

if (import.meta.main) {
  const listing = await fetch(
    BASE + collageApiUrl("lb", { user: USER, period: "all_time" }),
  );
  if (!listing.ok) {
    console.error(
      `stats request failed with ${listing.status}; is ${BASE} deployed with path URLs?`,
    );
    process.exit(1);
  }
  const { albums } = (await listing.json()) as { albums: { img?: string }[] };
  const coverUrls = [
    ...new Set(albums.map((a) => a.img).filter((img): img is string => !!img)),
  ].slice(0, COVERS);

  let failed = false;
  for (let round = 1; round <= ROUNDS; round++) {
    const statsUrls = PERIODS.map((period) =>
      collageApiUrl("lb", { user: USER, period }),
    );
    const results = await Promise.all([...statsUrls, ...coverUrls].map(get));
    const stats = results.slice(0, statsUrls.length);
    const covers = results.slice(statsUrls.length);
    const found = problems(stats, covers);
    const errors = results.filter((r) => r.status !== 200).length;
    console.log(
      `round ${round}: ${results.length} concurrent requests, ${errors} upstream errors, ${found.length} mixed-up responses`,
    );
    for (const line of found) console.log(`  ${line}`);
    failed ||= found.length > 0;
  }
  process.exit(failed ? 1 : 0);
}
