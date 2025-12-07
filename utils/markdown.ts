import markdownIt from "markdown-it";
import anchor from "markdown-it-anchor";

const anchorSlugify = (s: string,) =>
  encodeURIComponent(
    String(s,)
      .trim()
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=_`~()]/g, "",)
      .replace(/\s+/g, "-",),
  );

const anchorOpts = {
  placement: "after" as const, // Type assertion for literal type
  class: "heading-anchor",
};

const md = markdownIt({
  html: true,
  breaks: true,
  typographer: true,
},);

md.use(anchor, {
  permalink: anchor.permalink.linkInsideHeader(anchorOpts,),
  slugify: anchorSlugify,
},);

export default md;
