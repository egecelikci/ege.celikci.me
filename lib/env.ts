/**
 * Whether this is a production build.
 *
 * `pnpm run build` sets `MODE=production` and `pnpm run serve` sets `MODE=development`; anything else counts as development, so a bare `lume` never hits the network fetchers.
 */
export const isProduction = process.env.MODE === "production";
