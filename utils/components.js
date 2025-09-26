import htmlmin from "html-minifier";

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

export default {
  Icon,
};
