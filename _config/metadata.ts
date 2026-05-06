/**
 * _config/metadata.ts
 * Single source of truth for site and author constants.
 */

export const site = {
  title: "ege.celikci.me",
  host: "ege.celikci.me",
  lang: "en",
  locale: "en_US",
  url: "https://ege.celikci.me",
};

// Internal constants for reuse
const USERNAME = "egecelikci";
const EMAIL = "ege@celikci.me";
const MATRIX_USER = "eg";
const MATRIX_HOST = "metropolis.nexus";
const SIGNAL_URL =
  "aHR0cHM6Ly9zaWduYWwubWUvI2V1L3owc1ZpZzFYYzFtMWdNU0RwRnFWMDF1Qk5wSXZBV3d5X1k4aFVJNlhBckczcXBKNnVmcExsNVNSRlB4a3NzYWM=";

export const author = {
  name: "Ege Çelikçi",
  nickname: "eg",
  email: EMAIL,
  username: USERNAME,
  social: {
    mastodon: {
      name: "@eg@ieji.de",
      url: "https://ieji.de/@eg",
    },
    bluesky: {
      name: "@ege.celikci.me",
      url: "https://bsky.app/profile/did:plc:ecyojzioziuposnh6utazpu6",
    },
    signal: {
      url: SIGNAL_URL,
    },
    matrix: {
      username: MATRIX_USER,
      homeserver: MATRIX_HOST,
      devices: [
        { name: "Element Desktop", id: "F0xxKVPj64" },
        {
          name: "Element X Android",
          id: "+Zzdv2gXqVcZWldRyG+jamEeQG5aj0NB/0eUtgzCICA",
        },
      ],
    },
  },
  links: [
    {
      id: "signal",
      name: "Signal",
      url: atob(SIGNAL_URL),
      icon: "message-circle-dashed",
      label: "Preferred",
      priority: 1,
    },
    {
      id: "matrix",
      name: "Matrix",
      url: `https://matrix.to/#/@${MATRIX_USER}:${MATRIX_HOST}`,
      keyUrl: "/keys#matrix",
      icon: "messages-square",
      label: "Secondary",
      priority: 2,
    },
    {
      id: "email",
      name: "Email",
      url: `mailto:${EMAIL}`,
      icon: "mail",
      label: "Encrypted only",
      priority: 3,
    },
    {
      id: "github",
      name: "GitHub",
      url: `https://github.com/${USERNAME}`,
      relMe: true,
      icon: "github",
      label: "Code",
    },
    {
      id: "codeberg",
      name: "Codeberg",
      url: `https://codeberg.org/${USERNAME}`,
      relMe: true,
      icon: "mountain",
      label: "Code",
    },
    {
      id: "gitlab",
      name: "GitLab",
      url: `https://gitlab.com/${USERNAME}`,
      relMe: true,
      icon: "gitlab",
      label: "Code",
    },
    {
      id: "listenbrainz",
      name: "ListenBrainz",
      url: `https://listenbrainz.org/user/${USERNAME}`,
      icon: "music",
      label: "Music",
    },
    {
      id: "steam",
      name: "Steam",
      url: `https://steamcommunity.com/id/${USERNAME}`,
      icon: "gamepad",
      label: "Games",
    },
  ],
};
