import markdownIt from "markdown-it";
import anchor from "markdown-it-anchor";

const anchorOpts = {
  placement: "before",
  class: "heading-anchor",
};

export default markdownIt({
  html: true,
  breaks: true,
  typographer: true,
}).use(anchor, {
  permalink: anchor.permalink.linkInsideHeader(anchorOpts),
});
