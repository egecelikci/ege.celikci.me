import assert from "node:assert/strict";
import { test } from "node:test";
import { localPosterFile, posterPlan } from "./posters.ts";

test("a new event saves the original, not the thumbnail", () => {
  assert.deepEqual(posterPlan({ url: "o.jpg", thumb: "t.jpg" }), {
    imageUrl: "o.jpg",
    source: "original",
    force: true,
  });
});

test("an event already saved as an original is left alone", () => {
  assert.deepEqual(
    posterPlan(
      { url: "o.jpg", thumb: "t.jpg" },
      { posterUrl: "o.jpg", posterSource: "original" },
    ),
    { imageUrl: "o.jpg", source: "original", force: false },
  );
});

test("a 500px poster from before this rule is replaced by the original", () => {
  assert.deepEqual(
    posterPlan({ url: "o.jpg", thumb: "t.jpg" }, { posterUrl: "o.jpg" }).force,
    true,
  );
});

test("a changed original is downloaded again", () => {
  assert.deepEqual(
    posterPlan(
      { url: "new.jpg" },
      { posterUrl: "old.jpg", posterSource: "original" },
    ).force,
    true,
  );
});

test("the thumbnail is the fallback when there is no original, and is not re-downloaded for it", () => {
  assert.deepEqual(posterPlan({ thumb: "t.jpg" }, { posterSource: "thumb" }), {
    imageUrl: "t.jpg",
    source: "thumb",
    force: false,
  });
});

test("no poster means nothing to download", () => {
  assert.deepEqual(posterPlan({}), { force: false });
});

test("localPosterFile prefers the cached file, then any extension for the event", () => {
  const names = ["abc.jpg", "def.png", "abc.webp.part"];
  assert.deepEqual(localPosterFile(names, "abc", "abc.jpg"), "abc.jpg");
  assert.deepEqual(localPosterFile(names, "def"), "def.png");
  assert.deepEqual(localPosterFile(names, "abc", "gone.jpg"), "abc.jpg");
  assert.deepEqual(localPosterFile(names, "xyz"), undefined);
});
