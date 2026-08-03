/**
 * utils/cache.ts
 *
 * Minimal persistence layer for Lume data files.
 * Provides stable JSON file management with key sorting.
 */

import { ensureDir } from "@std/fs/ensure-dir";
import { dirname } from "@std/path";

/**
 * Load data from a JSON file.
 * Returns default value if file doesn't exist or is invalid.
 */
export async function loadState<T>(
  filePath: string,
  defaultValue: T,
): Promise<T> {
  try {
    const text = await Deno.readTextFile(filePath);
    return JSON.parse(text) as T;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[state] ⚠️ Failed to load ${filePath}:`, message);
    }
    return defaultValue;
  }
}

/**
 * Save data to a JSON file with stable key sorting.
 */
export async function saveState<T>(filePath: string, data: T): Promise<void> {
  try {
    await ensureDir(dirname(filePath));
    const sorted = sortObjectKeys(data);
    await Deno.writeTextFile(filePath, JSON.stringify(sorted, null, 2));
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
