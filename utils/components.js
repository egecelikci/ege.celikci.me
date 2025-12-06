import htmlmin from "html-minifier";
import markdownIt from "markdown-it";
import slugify from "@sindresorhus/slugify";

const markdown = markdownIt();

const minify = (content) =>
  htmlmin.minify(content, {
    removeComments: true,
    collapseWhitespace: true,
  });

export const Icon = (iconName, useInline = false) => {
  const spriteUrl = "/assets/icons/icons.sprite.svg";
  const iconId = `#svg-${iconName}`;
  const href = useInline ? iconId : spriteUrl + iconId;

  const output = `<svg class="icon icon--${iconName}" role="img" aria-hidden="true">
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

export const Callout = (content, type = "info") => {
  let icon;

  switch (type) {
    case "action":
      icon = "check";
      break;

    case "warning":
      icon = "alert";
      break;

    case "plus":
      icon = "plus";
      break;

    case "minus":
      icon = "minus";
      break;

    case "percent":
      icon = "percent";
      break;

    case "info":
    default:
      icon = "info";
      break;
  }

  const output = `<div class="callout callout--${type}">
        <span class="callout__icon">${Icon(icon)}</span>
        <div class="callout__content">${markdown.render(content)}</div>
    </div>`;

  return minify(output);
};

export default {
  Icon,
  renderTags,
  Callout,
};
