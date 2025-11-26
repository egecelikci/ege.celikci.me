import markdownIt from "markdown-it";
import anchor from "markdown-it-anchor";

const anchorSlugify = (s) =>
  encodeURIComponent(
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=_`~()]/g, "")
      .replace(/\s+/g, "-"),
  );

const anchorOpts = {
  placement: "after",
  class: "heading-anchor",
};

export default markdownIt({
  html: true,
  breaks: true,
  typographer: true,
}).use(anchor, {
  permalink: anchor.permalink.linkInsideHeader(anchorOpts),
  slugify: anchorSlugify,
});
