const isServe = Deno.args.includes("-s") || Deno.args.includes("--serve");
const systemEnv = Deno.env.get("LUME_ENV") || Deno.env.get("DENO_ENV");
const env = systemEnv || (isServe ? "development" : "production");

export default {
  env: env,
  timestamp: new Date(),
  /** Cache-busting query for assets; changes on every build. */
  id: crypto.randomUUID(),
};
