import { assertEquals } from "@std/assert";
import { redactUrl } from "./fetch-base.ts";

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
