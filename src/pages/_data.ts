// Default layout for all pages in this directory
export const layout = "layouts/page.vto";

// Default backlink for all pages
export const backlink = { href: "/", text: "home" };

// Strip the /pages/ prefix from URLs
export function url(page: { data: { url: string } }): string {
  return page.data.url.replace("/pages/", "/");
}
