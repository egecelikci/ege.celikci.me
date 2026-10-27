import { assertEquals } from "@std/assert";
import { redactUrl, retryAfterMs } from "./fetch-base.ts";

Deno.test("redactUrl hides credential query values and keeps the rest", () => {
  assertEquals(
    redactUrl("https://api.example/x?key=abc&steamid=1&token=t"),
    "https://api.example/x?key=***&steamid=1&token=***",
  );
  assertEquals(
    redactUrl("https://api.example/x?id=1"),
    "https://api.example/x?id=1",
  );
  assertEquals(redactUrl("not a url"), "not a url");
});

Deno.test("retryAfterMs reads seconds, HTTP dates, and falls back on junk", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  assertEquals(retryAfterMs("3", now), 3_000);
  assertEquals(retryAfterMs("Sat, 10 Oct 2026 12:00:07 GMT", now), 7_000);
  assertEquals(retryAfterMs("Sat, 10 Oct 2026 11:00:00 GMT", now), 0);
  assertEquals(retryAfterMs("3600", now), 60_000);
  assertEquals(retryAfterMs(null, now), 5_000);
  assertEquals(retryAfterMs("soon", now), 5_000);
});
