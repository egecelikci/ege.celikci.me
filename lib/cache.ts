/**
 * Minimal persistence layer for Lume data files.
 * Provides stable JSON file management with key sorting.
 */

import { ensureDir } from "@std/fs/ensure-dir";
import { dirname } from "@std/path";
import type { z } from "zod";

/**
 * A state file exists but cannot be trusted: it does not parse, or it fails its schema.
 *
 * Thrown instead of returning the default, because the jobs write their result back to the same tracked file: a silent default would let the next run overwrite good history with whatever partial set the API returned.
 */
export class StateError extends Error {
  override name = "StateError";
}

/**
 * Load data from a JSON file.
 *
 * @param filePath - The state file.
 * @param defaultValue - Returned only when the file does not exist yet.
 * @param schema - Validates the parsed data when given.
 * @returns The stored data, or `defaultValue` for a missing file.
 * @throws {StateError} When the file exists but does not parse or fails `schema`.
 */
export async function loadState<T>(
  filePath: string,
  defaultValue: T,
  schema?: z.ZodType<T>,
): Promise<T> {
  let text: string;
  try {
    text = await Deno.readTextFile(filePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return defaultValue;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new StateError(
      `${filePath} is not valid JSON: ${(error as Error).message}`,
    );
  }

  if (!schema) return parsed as T;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new StateError(
      `${filePath} failed validation: ${result.error.message}`,
    );
  }
  return result.data;
}

/**
 * Save data to a JSON file with stable key sorting.
 * When a schema is given, invalid data is rejected and the previous file is
 * left untouched.
 */
export async function saveState<T>(
  filePath: string,
  data: T,
  schema?: z.ZodType<T>,
): Promise<void> {
  if (schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
      console.error(
        `[state] ❌ Refusing to save invalid data to ${filePath}: ${result.error.message}`,
      );
      return;
    }
  }
  try {
    await ensureDir(dirname(filePath));
    const sorted = sortObjectKeys(data);
    // Write beside the target and rename over it: an interrupted write leaves the old file whole instead of a truncated one.
    const temp = `${filePath}.tmp`;
    await Deno.writeTextFile(temp, JSON.stringify(sorted, null, 2));
    await Deno.rename(temp, filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[state] ❌ Failed to save ${filePath}:`, message);
  }
}

/**
 * Recursively sort object keys for stable JSON output.
 * Essential for consistent git diffs across environments.
 */
export function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sortObjectKeys(item));
  }

  const sortedObj: Record<string, unknown> = {};
  const sortedKeys = Object.keys(obj).sort();
  for (const key of sortedKeys) {
    sortedObj[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sortedObj;
}
