import { assertEquals } from "@std/assert";
import { slugify } from "./slugify.ts";

Deno.test("slugify folds Turkish letters instead of dropping them", () => {
  assertEquals(slugify("Çay Saati!"), "cay-saati");
  assertEquals(slugify("İzmir"), "izmir");
  assertEquals(slugify("Şişli Güneş"), "sisli-gunes");
  assertEquals(slugify("ışık"), "isik");
  assertEquals(slugify("ÖĞRENCİ IŞIĞI"), "ogrenci-isigi");
});

Deno.test("slugify collapses and trims separators", () => {
  assertEquals(slugify("  Hello,   World!  "), "hello-world");
  assertEquals(slugify("a--b__c"), "a-b-c");
  assertEquals(slugify("2026: a year"), "2026-a-year");
});

Deno.test("slugify returns an empty string when nothing is left", () => {
  assertEquals(slugify(""), "");
  assertEquals(slugify("!!! — ???"), "");
  assertEquals(slugify("猫"), "");
});
