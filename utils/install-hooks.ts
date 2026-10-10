/**
 * Install the tracked Git hooks by writing small shims into `.git/hooks`.
 *
 * Shims are used instead of `core.hooksPath`, which would make Git ignore `.git/hooks` and with it the Git LFS hooks.
 * @module
 */

import { join } from "@std/path";

/** Marks shims this script wrote, so it never overwrites someone else's hook. */
const MARKER = "# installed by utils/install-hooks.ts";
const HOOKS = ["pre-commit"];

/** Run git and return its trimmed stdout. */
async function git(...args: string[]): Promise<string> {
  const { stdout, success } = await new Deno.Command("git", { args }).output();
  if (!success) throw new Error(`git ${args.join(" ")} failed`);
  return new TextDecoder().decode(stdout).trim();
}

/** Read a file, or `null` when it does not exist. */
async function readOrNull(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null;
    throw error;
  }
}

if (import.meta.main) {
  const hooksDir = await git("rev-parse", "--git-path", "hooks");
  await Deno.mkdir(hooksDir, { recursive: true });

  for (const hook of HOOKS) {
    const path = join(hooksDir, hook);
    const existing = await readOrNull(path);
    if (existing !== null && !existing.includes(MARKER)) {
      console.error(
        `✗ ${path} exists and was not written by this script; merge it by hand`,
      );
      Deno.exitCode = 1;
      continue;
    }
    await Deno.writeTextFile(
      path,
      `#!/bin/sh\n${MARKER}\nexec sh "$(git rev-parse --show-toplevel)/.githooks/${hook}" "$@"\n`,
      { mode: 0o755 },
    );
    // `mode` only applies to new files, so make an existing shim executable too.
    await Deno.chmod(path, 0o755);
    console.log(`✓ ${hook}`);
  }
}
