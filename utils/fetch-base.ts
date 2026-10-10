/** Query parameters that carry credentials and must never reach the build log. */
const SECRET_PARAMS = /^(key|api_key|token|access_token|password)$/i;

/**
 * Hide credential values in a URL before logging it.
 *
 * @param url - The request URL.
 * @returns The URL with secret query values replaced by `***`, or the input when it is not a valid URL.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const name of [...parsed.searchParams.keys()]) {
      if (SECRET_PARAMS.test(name)) parsed.searchParams.set(name, "***");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export type CachePolicy = "no-cache" | "force-cache" | "only-if-cached";

interface HttpClientOptions {
  userAgent: string;
  rateLimitMs?: number;
  cacheName: string;
}

export class HttpClient {
  private userAgent: string;
  private rateLimitMs: number;
  private lastFetch: number = 0;
  private cacheName: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: HttpClientOptions) {
    this.userAgent = options.userAgent;
    this.rateLimitMs = options.rateLimitMs ?? 0;
    this.cacheName = options.cacheName;
  }

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
          continue;
        }

        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response;
        }

        // A 500 is an application error for this specific request, so the same GET usually fails again and retrying only burns the exponential backoff. 502/503/504 are the upstream-backend statuses that do clear up, so they keep retrying.
        if (response.status === 500) {
          console.warn(`[http] HTTP 500 for ${redactUrl(url)}, giving up`);
          return response;
        }

        lastError = new Error(
          `HTTP ${response.status}: ${response.statusText}`,
        );
      } catch (err) {
        lastError = err as Error;
      }

      const delay = Math.pow(2, i) * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }

    console.warn(
      `[http] Max retries reached for ${redactUrl(url)}:`,
      lastError?.message,
    );
    return null;
  }

  /**
   * Main fetch method with rate-limiting and Web Cache API support.
   */
  async fetch<T>(
    url: string,
    type: "json" | "buffer" = "json",
    cachePolicy: CachePolicy = "force-cache",
    bypassRateLimit = false,
  ): Promise<T | null> {
    const cache = await caches.open(this.cacheName);
    const request = new Request(url, {
      headers: {
        "User-Agent": this.userAgent,
        "Accept": "application/json; charset=utf-8",
        "Content-Type": "application/json; charset=utf-8",
      },
    });

    if (cachePolicy !== "no-cache") {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        if (type === "json") {
          try {
            const buffer = await cachedResponse.arrayBuffer();
            const text = new TextDecoder("utf-8").decode(buffer);
            return JSON.parse(text) as T;
          } catch {
            console.warn(
              `[http] Corrupt cached JSON for ${
                redactUrl(url)
              }, falling back to network`,
            );
          }
        } else {
          const buffer = await cachedResponse.arrayBuffer();
          return buffer as T;
        }
      }
    }

    if (cachePolicy === "only-if-cached") {
      return null;
    }

    if (!bypassRateLimit && this.rateLimitMs > 0) {
      const result = this.queue.then(async () => {
        const now = Date.now();
        const elapsed = now - this.lastFetch;
        if (elapsed < this.rateLimitMs) {
          await new Promise((r) => setTimeout(r, this.rateLimitMs - elapsed));
        }
        return await this.performFetch<T>(url, type, cache, request);
      });
      this.queue = result.then(() => {}).catch(() => {});
      return result;
    }

    return await this.performFetch<T>(url, type, cache, request);
  }

  private async performFetch<T>(
    url: string,
    type: "json" | "buffer",
    cache: Cache,
    request: Request,
  ): Promise<T | null> {
    try {
      const response = await this.robustFetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          "Accept": "application/json; charset=utf-8",
          "Content-Type": "application/json; charset=utf-8",
        },
      });

      this.lastFetch = Date.now();

      if (!response || !response.ok) return null;

      const contentType = response.headers.get("Content-Type") || "";

      await cache.put(request, response.clone());

      if (type === "json") {
        if (!contentType.includes("application/json")) {
          console.warn(
            `[http] Expected JSON but got ${contentType} for ${redactUrl(url)}`,
          );
          return null;
        }
        const buffer = await response.arrayBuffer();
        const text = new TextDecoder("utf-8").decode(buffer);
        return JSON.parse(text) as T;
      } else {
        const buffer = await response.arrayBuffer();
        return buffer as T;
      }
    } catch (err) {
      console.warn(
        `[http] Fetch failed for ${redactUrl(url)}:`,
        (err as Error).message,
      );
      return null;
    }
  }
}
