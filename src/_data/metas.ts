// src/_data/metas.ts
import author from "./author.json" with { type: "json" };
import site from "./site.ts";

export default {
  // Use data from site.ts directly
  site: site.title,
  description: site.description,
  lang: site.lang,
  url: site.url,
  author: author.name,
  fediverse: author.social.mastodon.url,
  title: "=title",
  image: "=image",
  icon: "/assets/images/favicon/favicon.svg",
  generator: true,
};