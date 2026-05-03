import { site as siteData } from "../../_config/metadata.ts";

export default [
  {
    id: "main",
    title: "Site Feed",
    description:
      "The master feeds containing all long-form writing and ephemeral notes.",
    query: "type=post|note",
    limit: 1000,
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
    limit: 1000,
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
    limit: 1000,
    output: ["/blog.atom", "/blog.json"],
    info: {
      title: `blog | ${siteData.host}`,
      description: siteData.description,
    },
  },
  {
    id: "events",
    title: "Events",
    description: "Upcoming and past music events.",
    query: "type=event",
    limit: 1000,
    output: ["/events.atom", "/events.json"],
    info: {
      title: `events | ${siteData.host}`,
      description: "Music events and concerts calendar.",
    },
  },
];
