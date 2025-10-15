import htmlmin from "html-minifier";
import slugify from "@sindresorhus/slugify";

const minify = (content) =>
  htmlmin.minify(content, {
    removeComments: true,
    collapseWhitespace: true,
  });

export const Icon = (iconName, useInline = false) => {
  const spriteUrl = "/assets/icons/icons.sprite.svg";
  const iconId = `#svg-${iconName}`;
  const href = useInline ? iconId : spriteUrl + iconId;

  const output = `<svg class="icon icon--${iconName}" role="img" aria-hidden="true" width="24" height="24">
        <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="${href}"></use>
    </svg>`;

  return minify(output);
};

export const renderTags = (tags) => {
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return "";
  }
  const escaped = tags.map((tag) => {
    return {
      name: tag,
      url: "/tag/" + slugify(tag),
    };
  });

  let output = "";

  {
    const len = escaped.length;
    escaped.forEach((tagObj, idx) => {
      output += `<a href="${tagObj.url}">${tagObj.name}</a>`;
      if (len === 2 && idx === 0) {
        output += "&nbsp;&amp; ";
      } else if (len > 2) {
        if (idx < len - 2) {
          output += ", ";
        } else if (idx === len - 2) {
          output += "&nbsp;&amp; ";
        }
      }
    });
  }

  return minify(output);
};

export default {
  Icon,
  renderTags,
};
