// deno-lint-ignore-file no-explicit-any
import Image from "npm:@11ty/eleventy-img@^6.0.4";
import { Callout, Icon, renderTags, } from "./components.ts";

export const syncShortcodes: Record<string, any> = {
  icon: Icon,
  renderTags: renderTags,
};

export const pairedShortcodes: Record<string, any> = {
  callout: Callout,
};

export const ogImage = async (filepath: string,): Promise<string> => {
  if (!filepath || filepath.startsWith("http",)) return filepath;

  try {
    const metadata = await Image(filepath, {
      widths: [1200,],
      formats: ["jpeg",],
      urlPath: "/assets/images/og/",
      outputDir: "./dist/assets/images/og/",
      cacheOptions: {
        duration: "1d",
      },
    },);

    const data = metadata.jpeg[0];
    return data.url;
  } catch (e) {
    console.error(`[ogImage] Error processing ${filepath}:`, e,);
    return "";
  }
};

export const asyncShortcodes: Record<string, any> = {
  ogImage,
};
