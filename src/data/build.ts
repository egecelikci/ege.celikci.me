import { execSync, } from "node:child_process";

const timestamp = new Date();
const env = Deno.env.get("NODE_ENV",);

const umamiScriptUrl = Deno.env.get("UMAMI_SCRIPT_URL",);
const umamiWebsiteId = Deno.env.get("UMAMI_WEBSITE_ID",);

function isCSSNakedDay(): boolean {
  const now = Date.now();
  const currentYear = new Date().getFullYear();
  const startEpoch = new Date(`${currentYear}-04-09T00:00:00+1400`,).getTime();
  const endEpoch = new Date(`${currentYear}-04-09T23:59:59-1200`,).getTime();
  return startEpoch <= now && now <= endEpoch;
}

function gitHash(): string {
  try {
    return execSync("git rev-parse HEAD",).toString().trim();
  } catch {
    return "unknown";
  }
}

export default {
  env: env,
  dev: env !== "production",
  timestamp: timestamp,
  id: timestamp.valueOf(),
  naked: isCSSNakedDay(),
  git: gitHash(),
  umamiScript: umamiScriptUrl,
  umamiId: umamiWebsiteId,
};
