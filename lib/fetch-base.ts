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
    // A copy, because `set` drops duplicate keys and would shift the live iterator.
    for (const name of Array.from(parsed.searchParams.keys())) {
      if (SECRET_PARAMS.test(name)) parsed.searchParams.set(name, "***");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Read a `Retry-After` header, which may be seconds or an HTTP date.
 *
 * @param header - The header value, or `null` when absent.
 * @param now - Current time in milliseconds, injectable for tests.
 * @returns The wait in milliseconds, between 0 and 60 seconds; 5 seconds when the header is missing or unreadable.
 */
export function retryAfterMs(header: string | null, now = Date.now()): number {
  const fallback = 5_000;
  if (!header) return fallback;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(header) - now;
  return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), 60_000) : fallback;
}

interface HttpClientOptions {
  userAgent: string;
  rateLimitMs?: number;
}

export class HttpClient {
  private userAgent: string;
  private rateLimitMs: number;
  private lastFetch: number = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: HttpClientOptions) {
    this.userAgent = options.userAgent;
    this.rateLimitMs = options.rateLimitMs ?? 0;
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
          await response.body?.cancel();
          await new Promise<void>((r) =>
            setTimeout(r, retryAfterMs(response.headers.get("Retry-After"))),
          );
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
   * Fetch through the rate limiter, with retries.
   *
   * @param bypassRateLimit - Skip the queue, for hosts other than the one the limit protects.
   * @returns The parsed JSON or the raw bytes, or `null` on any failure.
   */
  async fetch<T>(
    url: string,
    type: "json" | "buffer" = "json",
    bypassRateLimit = false,
  ): Promise<T | null> {
    if (!bypassRateLimit && this.rateLimitMs > 0) {
      const result = this.queue.then(async () => {
        const elapsed = Date.now() - this.lastFetch;
        if (elapsed < this.rateLimitMs) {
          await new Promise((r) => setTimeout(r, this.rateLimitMs - elapsed));
        }
        return await this.performFetch<T>(url, type);
      });
      this.queue = result.then(() => {}).catch(() => {});
      return result;
    }

    return await this.performFetch<T>(url, type);
  }

  private async performFetch<T>(
    url: string,
    type: "json" | "buffer",
  ): Promise<T | null> {
    try {
      const response = await this.robustFetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json; charset=utf-8",
          "Content-Type": "application/json; charset=utf-8",
        },
      });

      this.lastFetch = Date.now();

      if (!response || !response.ok) return null;

      const contentType = response.headers.get("Content-Type") || "";

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
