/**
 * Whether this is a production build.
 *
 * `deno task build` sets `MODE=production` and `deno task serve` sets `MODE=development`; anything else counts as development, so a bare `deno task lume` never hits the network fetchers.
 */
export const isProduction = Deno.env.get("MODE") === "production";
