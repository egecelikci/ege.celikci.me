import { log } from "lume/core/utils/log.ts";

export default function () {
  return (site: Lume.Site) => {
    site.addEventListener("beforeBuild", () => {
      const counts = countCommits(site.src());

      site.preprocess((pages) => {
        for (const page of pages) {
          if (page.data.type !== "note") continue;

          const path = site.src(page.sourcePath);
          page.data.edited = (counts.get(path) ?? 0) > 1;
        }
      });
    });
  };
}

function countCommits(root: string): Map<string, number> {
  const counts = new Map<string, number>();
  const toplevel = gitCommand("rev-parse", "--show-toplevel");

  if (!toplevel) {
    return counts;
  }

  const str = gitCommand("log", "--format=COMMIT:%H", "--name-only", "--", root);

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

const decoder = new TextDecoder();

function gitCommand(...args: string[]): string {
  const { code, stderr, stdout } = new Deno.Command("git", {
    args,
    stdout: "piped",
    stderr: "piped",
  }).outputSync();

  if (code !== 0) {
    log.error(`[edited plugin] Git error: ${decoder.decode(stderr)}`);
    return "";
  }

  return decoder.decode(stdout).trim();
}
