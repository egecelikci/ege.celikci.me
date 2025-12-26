export const layout = "layouts/content.vto";
export const type = "entry";
export const tags = ["meta",];

export function url(page: Lume.Page,) {
  if (page.data.basename === "index") {
    return "/meta/";
  }

  return `/meta/${page.data.basename}/`;
}
