/**
 * Exposes the icon vocabularies to templates: `it.icons.getLinkInfo(label, url)` for an external link, `it.icons.pageIcon(page)` for a page listed as a link.
 */

export {
  getLinkInfo,
  HOST_MAPPINGS,
  LINK_MAPPINGS,
} from "../../utils/links.ts";
export { pageIcon } from "../../utils/page-icons.ts";
