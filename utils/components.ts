import slugify from "@sindresorhus/slugify";
import htmlmin from "html-minifier";
import markdownIt from "markdown-it";

const markdown = markdownIt();

const minify = (content: string,): string =>
  htmlmin.minify(content, {
    removeComments: true,
    collapseWhitespace: true,
  },);

export const Icon = (
  iconName: string,
  width: string | number | null = null,
  height: string | number | null = null,
  useInline = false,
): string => {
  const spriteUrl = "/assets/icons/icons.sprite.svg";
  const iconId = `#svg-${iconName}`;
  const href = useInline ? iconId : spriteUrl + iconId;

  let sizeAttributes = "";
  if (width !== null) {
    sizeAttributes += ` width="${width}"`;
  }
  if (height !== null) {
    sizeAttributes += ` height="${height}"`;
  }

  const output =
    `<svg class="icon icon--${iconName}" role="img" aria-hidden="true"${sizeAttributes}>
        <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="${href}"></use>
    </svg>`;

  return minify(output,);
};

export const renderTags = (tags: string[] | null | undefined,): string => {
  if (!tags || !Array.isArray(tags,) || tags.length === 0) {
    return "";
  }
  const escaped = tags.map((tag,) => {
    return {
      name: tag,
      url: "/tag/" + slugify(tag,),
    };
  },);

  let output = "";

  {
    const len = escaped.length;
    escaped.forEach((tagObj, idx,) => {
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
    },);
  }

  return minify(output,);
};

export const Callout = (content: string, type = "info",): string => {
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
        <span class="callout__icon">${Icon(icon,)}</span>
        <div class="callout__content">${markdown.render(content,)}</div>
    </div>`;

  return minify(output,);
};

export default {
  Icon,
  renderTags,
  Callout,
};
