import author from "./author.ts";
import site from "./site.ts";

export default {
  site: site.title,
  description: "=description",
  lang: site.lang,
  url: site.url,
  author: author.name,
  fediverse: author.social.mastodon.name,
  title: "=title",
  image: "=metaImage || =image || =coverImage",
  icon: "/assets/images/favicon/favicon.svg",
  generator: true,
  // `type` is our page kind (note, event, tag), not an Open Graph type, so pages opt in with `ogType`.
  type: "=ogType || website",
  keywords: "=tags",
  robots: "=robots",
};
