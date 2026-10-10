import { assertEquals } from "@std/assert";
import { posterPlan } from "./posters.ts";

Deno.test("a new event saves the original, not the thumbnail", () => {
  assertEquals(posterPlan({ url: "o.jpg", thumb: "t.jpg" }), {
    imageUrl: "o.jpg",
    source: "original",
    force: true,
  });
});

Deno.test("an event already saved as an original is left alone", () => {
  assertEquals(
    posterPlan(
      { url: "o.jpg", thumb: "t.jpg" },
      { posterUrl: "o.jpg", posterSource: "original" },
    ),
    { imageUrl: "o.jpg", source: "original", force: false },
  );
});

Deno.test("a 500px poster from before this rule is replaced by the original", () => {
  assertEquals(
    posterPlan(
      { url: "o.jpg", thumb: "t.jpg" },
      { posterUrl: "o.jpg" },
    ).force,
    true,
  );
});

Deno.test("a changed original is downloaded again", () => {
  assertEquals(
    posterPlan(
      { url: "new.jpg" },
      { posterUrl: "old.jpg", posterSource: "original" },
    ).force,
    true,
  );
});

Deno.test("the thumbnail is the fallback when there is no original, and is not re-downloaded for it", () => {
  assertEquals(posterPlan({ thumb: "t.jpg" }, { posterSource: "thumb" }), {
    imageUrl: "t.jpg",
    source: "thumb",
    force: false,
  });
});

Deno.test("no poster means nothing to download", () => {
  assertEquals(posterPlan({}), { force: false });
});
