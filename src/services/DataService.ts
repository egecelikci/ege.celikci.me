/**
 * DataService - Unified caching and fetching layer
 *
 * Features:
 * - Content-based cache hashing
 * - Automatic retry with exponential backoff
 * - Graceful fallback to stale cache on failure
 * - Type-safe responses
 */

import { crypto, } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { ensureDir, } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join, } from "https://deno.land/std@0.224.0/path/mod.ts";

export interface CacheOptions {
  duration: string; // e.g., "30d", "1h", "0s"
  gracefulFallback?: boolean; // Use stale cache on error
  retries?: number;
  retryDelay?: number;
}

export interface FetchResult<T,> {
  data: T;
  cached: boolean;
  timestamp: Date;
}

export class DataService {
  private cacheDir: string;
  private defaultRetries = 3;
  private defaultRetryDelay = 1000; // ms

  constructor(cacheDir = "./_cache",) {
    this.cacheDir = cacheDir;
  }

  /**
   * Fetch data with intelligent caching and retry logic
   */
  async fetch<T,>(
    url: string,
    options: CacheOptions & RequestInit = {},
  ): Promise<FetchResult<T>> {
    const {
      duration = "24h",
      gracefulFallback = true,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
      ...fetchOptions
    } = options;

    // Generate cache key from URL + options
    const cacheKey = await this.generateCacheKey(url, fetchOptions,);
    const cachePath = join(this.cacheDir, "http", `${cacheKey}.json`,);

    // Check cache validity
    const cachedData = await this.readCache<T>(cachePath, duration,);
    if (cachedData) {
      return { data: cachedData, cached: true, timestamp: new Date(), };
    }

    // Fetch with retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, fetchOptions,);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`,);
        }

        const data = await response.json() as T;
        await this.writeCache(cachePath, data,);
        return { data, cached: false, timestamp: new Date(), };
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[DataService] Attempt ${
            attempt + 1
          }/${retries} failed: ${error.message}`,
        );
        if (attempt < retries - 1) {
          await this.sleep(retryDelay * Math.pow(2, attempt,),); // Exponential backoff
        }
      }
    }

    // Graceful fallback: use stale cache if available
    if (gracefulFallback) {
      const staleData = await this.readCache<T>(cachePath, "999y",); // Ignore expiry
      if (staleData) {
        console.warn(
          `[DataService] Using stale cache for ${url} due to fetch failure`,
        );
        return { data: staleData, cached: true, timestamp: new Date(), };
      }
    }

    throw new Error(
      `Failed to fetch ${url} after ${retries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Fetch binary data (for images, PDFs, etc.)
   */
  async fetchBuffer(
    url: string,
    options: CacheOptions & RequestInit = {},
  ): Promise<{ data: Uint8Array; cached: boolean; }> {
    const {
      duration = "24h",
      gracefulFallback = true,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
      ...fetchOptions
    } = options;

    const cacheKey = await this.generateCacheKey(url, fetchOptions,);
    const cachePath = join(this.cacheDir, "buffers", `${cacheKey}.bin`,);

    // Check cache
    const cachedBuffer = await this.readBufferCache(cachePath, duration,);
    if (cachedBuffer) {
      return { data: cachedBuffer, cached: true, };
    }

    // Fetch with retry
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, fetchOptions,);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`,);
        }

        const buffer = new Uint8Array(await response.arrayBuffer(),);
        await this.writeBufferCache(cachePath, buffer,);
        return { data: buffer, cached: false, };
      } catch (error) {
        lastError = error as Error;
        if (attempt < retries - 1) {
          await this.sleep(retryDelay * Math.pow(2, attempt,),);
        }
      }
    }

    // Fallback to stale cache
    if (gracefulFallback) {
      const staleBuffer = await this.readBufferCache(cachePath, "999y",);
      if (staleBuffer) {
        console.warn(`[DataService] Using stale buffer cache for ${url}`,);
        return { data: staleBuffer, cached: true, };
      }
    }

    throw new Error(
      `Failed to fetch buffer from ${url}: ${lastError?.message}`,
    );
  }

  private async generateCacheKey(
    url: string,
    options: RequestInit,
  ): Promise<string> {
    const content = JSON.stringify({ url, options, },);
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(content,),
    );
    return Array.from(new Uint8Array(hash,),)
      .map((b,) => b.toString(16,).padStart(2, "0",))
      .join("",);
  }

  private async readCache<T,>(
    path: string,
    maxAge: string,
  ): Promise<T | null> {
    try {
      const stat = await Deno.stat(path,);
      const age = Date.now() - stat.mtime!.getTime();
      const maxAgeMs = this.parseDuration(maxAge,);

      if (age > maxAgeMs) return null;

      const data = await Deno.readTextFile(path,);
      return JSON.parse(data,);
    } catch {
      return null;
    }
  }

  private async readBufferCache(
    path: string,
    maxAge: string,
  ): Promise<Uint8Array | null> {
    try {
      const stat = await Deno.stat(path,);
      const age = Date.now() - stat.mtime!.getTime();
      const maxAgeMs = this.parseDuration(maxAge,);

      if (age > maxAgeMs) return null;

      return await Deno.readFile(path,);
    } catch {
      return null;
    }
  }

  private async writeCache<T,>(path: string, data: T,): Promise<void> {
    await ensureDir(join(this.cacheDir, "http",),);
    await Deno.writeTextFile(path, JSON.stringify(data, null, 2,),);
  }

  private async writeBufferCache(
    path: string,
    data: Uint8Array,
  ): Promise<void> {
    await ensureDir(join(this.cacheDir, "buffers",),);
    await Deno.writeFile(path, data,);
  }

  private parseDuration(duration: string,): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
      y: 31536000000,
    };
    const match = duration.match(/^(\d+)([smhdy])$/,);
    if (!match) throw new Error(`Invalid duration: ${duration}`,);
    return parseInt(match[1],) * units[match[2]];
  }

  private sleep(ms: number,): Promise<void> {
    return new Promise((resolve,) => setTimeout(resolve, ms,));
  }
}
