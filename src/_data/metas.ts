// src/_data/metas.ts
import author from "./author.ts";
import site from "./site.ts";

export default {
  site: site.title,
  description: "=description || " + `"${site.description}"`,
  lang: site.lang,
  url: site.url,
  author: author.name,
  fediverse: author.social.mastodon.url,
  title: "=title",
  image: "=metaImage || =image || =coverImage",
  icon: "/assets/images/favicon/favicon.svg",
  generator: true,
  type: "=type || website",
  keywords: "=tags",
  robots: "=robots",
  color: ["#fef6e4", "#463366"], // Light and dark theme colors
};
