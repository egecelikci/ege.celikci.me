import { site as siteData } from "../../_config/metadata.ts";

export default [
  {
    id: "main",
    title: "site feed",
    description: "this one includes notes",
    query: "type=note",
    limit: 1000,
    output: ["/feed.atom", "/feed.json"],
    info: {
      title: siteData.host,
    },
  },
  {
    id: "notes",
    query: "type=note",
    limit: 1000,
    output: ["/notes.atom", "/notes.json"],
    info: {
      title: `notes | ${siteData.host}`,
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
