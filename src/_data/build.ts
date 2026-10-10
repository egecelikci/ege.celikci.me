import { isProduction } from "../../utils/env.ts";

const env = isProduction ? "production" : "development";

export default {
  env: env,
  timestamp: new Date(),
  /** Cache-busting query for assets; changes on every build. */
  id: crypto.randomUUID(),
};
