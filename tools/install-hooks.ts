/**
 * Install the tracked Git hooks by writing small shims into `.git/hooks`.
 *
 * Shims are used instead of `core.hooksPath`, which would make Git ignore `.git/hooks` and with it the Git LFS hooks.
 * @module
 */

import { execFileSync } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Marks shims this script wrote, so it never overwrites someone else's hook. */
const MARKER = "# installed by tools/install-hooks.ts";
/** Earlier runs stamped their own path here, so any of our own markers still counts as ours. */
const WRITTEN_BY_US = "# installed by ";
const HOOKS = ["pre-commit"];

/** Run git and return its trimmed stdout. */
const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

/** Read a file, or `null` when it does not exist. */
async function readOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

if (import.meta.main) {
  const hooksDir = git("rev-parse", "--git-path", "hooks");
  await mkdir(hooksDir, { recursive: true });

  for (const hook of HOOKS) {
    const path = join(hooksDir, hook);
    const existing = await readOrNull(path);
    if (existing !== null && !existing.includes(WRITTEN_BY_US)) {
      console.error(
        `✗ ${path} exists and was not written by this script; merge it by hand`,
      );
      process.exitCode = 1;
      continue;
    }
    await writeFile(
      path,
      `#!/bin/sh\n${MARKER}\nexec sh "$(git rev-parse --show-toplevel)/.githooks/${hook}" "$@"\n`,
      { mode: 0o755 },
    );
    // `mode` only applies to new files, so make an existing shim executable too.
    await chmod(path, 0o755);
    console.log(`✓ ${hook}`);
  }
}
