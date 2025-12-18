import author from "./author.json" with { type: "json", };
import site from "./site.ts";

export default {
  site: "=site.title",
  fediverse: author.social.mastodon.name,
  icon: "assets/images/favicon/favicon.ico",
  lang: site.lang,
  author: author.name,
  title: "=title",
  description: "=description",
  image: "=image",
};
