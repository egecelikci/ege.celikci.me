/**
 * utils/fetch-base.ts
 *
 * Shared utilities for data fetching scripts (music, events, etc.)
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs/ensure-dir";
import { encodeHex } from "@std/encoding/hex";
import { crypto } from "@std/crypto";

// ============================================================================
// FILE CACHE
// ============================================================================

export class FileCache {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private async getPath(url: string): Promise<string> {
    // Use SHA-256 hash to avoid collisions for long URLs
    const urlUint8 = new TextEncoder().encode(url);
    const hashBuffer = await crypto.subtle.digest("SHA-256", urlUint8);
    const hashHex = encodeHex(hashBuffer);
    return join(this.dir, `${hashHex}.cache`);
  }

  async getJson<T>(url: string): Promise<T | null> {
    try {
      const path = await this.getPath(url);
      const content = await Deno.readTextFile(path);
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async setJson(url: string, data: any): Promise<void> {
    await ensureDir(this.dir);
    const path = await this.getPath(url);
    await Deno.writeTextFile(path, JSON.stringify(data, null, 2));
  }

  async getBuffer(url: string): Promise<ArrayBuffer | null> {
    try {
      const path = await this.getPath(url);
      const data = await Deno.readFile(path);
      return data.buffer;
    } catch {
      return null;
    }
  }

  async setBuffer(url: string, buffer: ArrayBuffer): Promise<void> {
    await ensureDir(this.dir);
    const path = await this.getPath(url);
    await Deno.writeFile(path, new Uint8Array(buffer));
  }
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

interface HttpClientOptions {
  userAgent: string;
  rateLimitMs?: number;
  httpCacheDir: string;
}

export class HttpClient {
  private userAgent: string;
  private rateLimitMs: number;
  private lastFetch: number = 0;
  private fileCache: FileCache;

  constructor(options: HttpClientOptions) {
    this.userAgent = options.userAgent;
    this.rateLimitMs = options.rateLimitMs ?? 0;
    this.fileCache = new FileCache(options.httpCacheDir);
  }

  /**
   * Fetches a resource with retries, timeout, and custom User-Agent.
   * Logic derived from robustFetch in previous iterations.
   */
  private async robustFetch(
    url: string,
    init: RequestInit = {},
    maxRetries = 3,
    timeoutMs = 15000,
  ): Promise<Response | null> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get("Retry-After") ?? "5",
            10,
          );
          await new Promise<void>((r) => setTimeout(r, retryAfter * 1_000));
          lastError = new Error("Rate limited (429)");
          continue; // force retry
        }

        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response;
        }
        lastError = new Error(
          `HTTP ${response.status}: ${response.statusText}`,
        );
      } catch (err) {
        lastError = err as Error;
      }

      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, i) * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }

    console.warn(`[http] Max retries reached for ${url}:`, lastError?.message);
    return null;
  }

  /**
   * Main fetch method with rate-limiting and local caching support.
   */
  async getCachedJson<T>(url: string): Promise<T | null> {
    return await this.fileCache.getJson<T>(url);
  }

  async fetch<T>(
    url: string,
    type: "json" | "buffer" = "json",
    cacheStrategy: "no-cache" | "force-cache" = "force-cache",
    bypassRateLimit = false,
  ): Promise<T | null> {
    // 1. Check cache
    if (cacheStrategy === "force-cache") {
      const cached = type === "json"
        ? await this.fileCache.getJson<T>(url)
        : await this.fileCache.getBuffer(url) as T;
      if (cached) return cached;
    }

    // 2. Rate limit
    if (!bypassRateLimit && this.rateLimitMs > 0) {
      const now = Date.now();
      const elapsed = now - this.lastFetch;
      if (elapsed < this.rateLimitMs) {
        await new Promise((r) => setTimeout(r, this.rateLimitMs - elapsed));
      }
    }

    // 3. Network Fetch
    try {
      const response = await this.robustFetch(url, {
        headers: { "User-Agent": this.userAgent },
      });

      this.lastFetch = Date.now();

      if (!response || !response.ok) return null;

      const contentType = response.headers.get("Content-Type") || "";

      if (type === "json") {
        if (!contentType.includes("application/json")) {
          console.warn(
            `[http] Expected JSON but got ${contentType} for ${url}`,
          );
          return null;
        }
        const data = await response.json() as T;
        this.fileCache.setJson(url, data).catch((err) =>
          console.warn("[http-cache] write failed for", url, err)
        );
        return data;
      } else {
        // For buffers (images/binaries), we want to be more careful
        if (
          contentType.includes("text/html") ||
          contentType.includes("application/json")
        ) {
          console.warn(
            `[http] Expected binary/image but got ${contentType} for ${url}`,
          );
          return null;
        }
        const buffer = await response.arrayBuffer() as T;
        this.fileCache.setBuffer(url, buffer as ArrayBuffer).catch((err) =>
          console.warn("[http-cache] write failed for", url, err)
        );
        return buffer;
      }
    } catch {
      return null;
    }
  }
}
