import { site as siteData } from "../../_config/metadata.ts";

export default [
  {
    id: "main",
    title: "Site Feed",
    description:
      "The master feeds containing all long-form writing and ephemeral notes.",
    query: "type=post|note",
    output: ["/feed.atom", "/feed.json"],
    info: {
      title: siteData.host,
      description: siteData.description,
    },
  },
  {
    id: "notes",
    title: "Notes",
    description: "Short-form updates and logs.",
    query: "type=note",
    output: ["/notes.atom", "/notes.json"],
    info: {
      title: `notes | ${siteData.host}`,
      description: siteData.description,
    },
  },
  {
    id: "blog",
    title: "Writing",
    description: "Long-form essays and articles.",
    query: "type=post",
    output: ["/blog.atom", "/blog.json"],
    info: {
      title: `blog | ${siteData.host}`,
      description: siteData.description,
    },
  },
];
