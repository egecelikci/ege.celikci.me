import { site as siteData } from "../../_config/metadata.ts";

export default [
  {
    id: "main",
    title: "site feed",
    description: "this one includes blog posts and notes",
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
    query: "type=event",
    limit: 1000,
    output: ["/events.atom", "/events.json"],
    info: {
      title: `events | ${siteData.host}`,
      description: "Music events and concerts calendar.",
    },
  },
];
