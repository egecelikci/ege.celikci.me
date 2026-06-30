import { author } from "../_config/metadata.ts";

export const url = "/webfinger.json";
export const layout = null;

export default function () {
  const data = {
    subject: `acct:${author.email}`,
    links: [
      {
        rel: "http://openid.net/specs/connect/1.0/issuer",
        href: "https://codeberg.org",
      },
    ],
  };

  return JSON.stringify(data, null, 2);
}
