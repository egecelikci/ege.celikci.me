// src/_data/metas.ts
import author from "./author.ts";
import site from "./site.ts";

export default {
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
