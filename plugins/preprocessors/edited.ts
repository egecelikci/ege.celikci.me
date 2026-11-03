import { execFileSync } from "node:child_process";
import { log } from "@lumeland/core/utils/log.ts";

export default function () {
  return (site: Lume.Site) => {
    let counts = new Map<string, number>();

    // Recount on every build so serve picks up new commits, but register the preprocessor once; registering it here would add another copy on every rebuild.
    site.addEventListener("beforeBuild", () => {
      counts = countCommits(site.src());
    });

    site.preprocess((pages) => {
      for (const page of pages) {
        if (page.data.type !== "note") continue;

        const path = site.src(page.sourcePath);
        page.data.edited = (counts.get(path) ?? 0) > 1;
      }
    });
  };
}

function countCommits(root: string): Map<string, number> {
  const counts = new Map<string, number>();
  const toplevel = gitCommand("rev-parse", "--show-toplevel");

  if (!toplevel) {
    return counts;
  }

  const str = gitCommand(
    "log",
    "--format=COMMIT:%H",
    "--name-only",
    "--",
    root,
  );

  if (!str) {
    return counts;
  }

  const base = toplevel.replace(/\/+$/, "");
  let currentCommit: string | undefined;
  for (const line of str.split("\n")) {
    const text = line.trim();

    if (text.startsWith("COMMIT:")) {
      currentCommit = text;
      continue;
    }

    if (text && currentCommit) {
      const path = `${base}/${text}`;
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  }

  return counts;
}

function gitCommand(...args: string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    log.error(
      `[edited plugin] Git error: ${
        (error as { stderr?: string }).stderr ?? error
      }`,
    );
    return "";
  }
}
