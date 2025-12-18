// src/_data/build.ts

/**
 * Gets the current git commit hash synchronously.
 */
function getGitHash(): string {
  try {
    const command = new Deno.Command("git", {
      args: ["rev-parse", "HEAD",],
    },);
    const { stdout, } = command.outputSync();
    return new TextDecoder().decode(stdout,).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Checks if it is currently CSS Naked Day.
 */
function isCSSNakedDay(): boolean {
  const now = Date.now();
  const currentYear = new Date().getFullYear();
  // CSS Naked Day is April 9th
  const startEpoch = new Date(`${currentYear}-04-09T00:00:00+1400`,).getTime();
  const endEpoch = new Date(`${currentYear}-04-09T23:59:59-1200`,).getTime();
  return startEpoch <= now && now <= endEpoch;
}

// Env vars
const env = Deno.env.get("LUME_ENV",) || Deno.env.get("DENO_ENV",)
  || "development";
const umamiScriptUrl = Deno.env.get("UMAMI_SCRIPT_URL",);
const umamiWebsiteId = Deno.env.get("UMAMI_WEBSITE_ID",);
const timestamp = new Date();

export default {
  env: env,
  dev: env !== "production",
  timestamp: timestamp,
  id: timestamp.valueOf(),
  naked: isCSSNakedDay(),
  git: getGitHash(),
  umamiScript: umamiScriptUrl,
  umamiId: umamiWebsiteId,
};
