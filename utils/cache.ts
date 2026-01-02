/**
 * Shared Cache Manager
 *
 * Reusable persistence layer for Lume data files.
 * Handles JSON file caching with validation and error handling.
 */

import { ensureDir, } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface CacheOptions {
  /** Path to the cache file */
  filePath: string;

  /** Name for logging (e.g., "music", "webmentions") */
  name: string;

  /** Optional validator function */
  validator?: (data: unknown,) => boolean;
}

// ============================================================================
// CACHE MANAGER
// ============================================================================

export class CacheManager<T,> {
  private data: T | null = null;
  private loaded = false;

  constructor(private options: CacheOptions,) {}

  /**
   * Load data from cache file
   */
  async load(defaultValue: T,): Promise<T> {
    if (this.loaded) {
      return this.data ?? defaultValue;
    }

    try {
      const text = await Deno.readTextFile(this.options.filePath,);
      const parsed = JSON.parse(text,) as T;

      // Validate if validator provided
      if (this.options.validator && !this.options.validator(parsed,)) {
        this.log("warn", "Invalid cache structure, using default",);
        this.data = defaultValue;
        this.loaded = true;
        return defaultValue;
      }

      this.data = parsed;
      this.loaded = true;
      this.log("info", `Loaded cache successfully`,);
      return parsed;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        this.log("info", "No cache found, starting fresh",);
      } else {
        this.log("warn", `Failed to load cache: ${(error as Error).message}`,);
      }

      this.data = defaultValue;
      this.loaded = true;
      return defaultValue;
    }
  }

  /**
   * Save data to cache file
   */
  async save(data: T,): Promise<void> {
    try {
      // Ensure directory exists
      const dir = this.options.filePath.substring(
        0,
        this.options.filePath.lastIndexOf("/",),
      );
      await ensureDir(dir,);

      // Write to file
      await Deno.writeTextFile(
        this.options.filePath,
        JSON.stringify(data, null, 2,),
      );

      this.data = data;
      this.log("info", "Saved cache successfully",);
    } catch (error) {
      this.log("error", `Failed to save cache: ${(error as Error).message}`,);
    }
  }

  /**
   * Get cached data without loading from file
   */
  get(): T | null {
    return this.data;
  }

  /**
   * Check if cache has been loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Clear in-memory cache
   */
  clear(): void {
    this.data = null;
    this.loaded = false;
  }

  /**
   * Delete cache file
   */
  async delete(): Promise<void> {
    try {
      await Deno.remove(this.options.filePath,);
      this.data = null;
      this.loaded = false;
      this.log("info", "Cache file deleted",);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        this.log(
          "error",
          `Failed to delete cache: ${(error as Error).message}`,
        );
      }
    }
  }

  private log(level: "info" | "warn" | "error", message: string,): void {
    const prefix = `[${this.options.name}]`;
    const icons = {
      info: "💾",
      warn: "⚠️",
      error: "❌",
    };

    const icon = icons[level];
    const fullMessage = `${prefix} ${icon} ${message}`;

    switch (level) {
      case "info":
        console.log(fullMessage,);
        break;
      case "warn":
        console.warn(fullMessage,);
        break;
      case "error":
        console.error(fullMessage,);
        break;
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a cache manager with typed data
 */
export function createCache<T,>(options: CacheOptions,): CacheManager<T> {
  return new CacheManager<T>(options,);
}

/**
 * Validator for array-based cache data
 */
export function arrayValidator(data: unknown,): boolean {
  return Array.isArray(data,);
}

/**
 * Validator for object with specific keys
 */
export function objectValidator(
  requiredKeys: string[],
): (data: unknown,) => boolean {
  return (data: unknown,): boolean => {
    if (typeof data !== "object" || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;
    return requiredKeys.every((key,) => key in obj);
  };
}
