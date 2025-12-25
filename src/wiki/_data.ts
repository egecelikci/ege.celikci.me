export const layout = "layouts/wiki.vto";
export const type = "entry";
export const templateEngine = ["vto", "md",];

// This function dynamically generates the URL based on the filename
export function url(page: Lume.Page,) {
  return `/${page.data.basename}/`;
}
