/**
 * _config/types.ts
 * Lume and Site-wide type augmentations.
 */

import "lume/types.ts";

export interface SiteData {
  site: {
    title: string;
    host: string;
    description: string;
    lang: string;
    locale: string;
    url: string;
  };
  author: {
    name: string;
    avatar: string;
    email: string;
    username: string;
    links: Array<{
      id: string;
      name: string;
      url: string;
      icon: string;
      label?: string;
      relMe?: boolean;
      keyUrl?: string;
      priority?: number;
    }>;
    social: {
      mastodon: { name: string; url: string; };
      signal: { url: string; };
      matrix: {
        username: string;
        homeserver: string;
        devices: Array<{ name: string; id: string; }>;
      };
    };
  };
}

declare global {
  namespace Lume {
    export interface Data extends SiteData {}
  }
}
