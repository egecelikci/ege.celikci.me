import { execSync } from "child_process";
const timestamp = new Date();
const env = process.env.NODE_ENV;

const umamiScriptUrl = process.env.UMAMI_SCRIPT_URL;
const umamiWebsiteId = process.env.UMAMI_WEBSITE_ID;

function isCSSNakedDay() {
  const now = Date.now();
  const currentYear = new Date().getFullYear();
  const startEpoch = new Date(`${currentYear}-04-09T00:00:00+1400`).getTime();
  const endEpoch = new Date(`${currentYear}-04-09T23:59:59-1200`).getTime();
  return startEpoch <= now && now <= endEpoch;
}

function gitHash() {
  return execSync("git rev-parse HEAD").toString().trim();
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
