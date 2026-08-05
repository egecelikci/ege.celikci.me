const README_PATH = new URL("../../README.md", import.meta.url);

const section = (title: string, readme: string): string => {
  const part = readme.split(/^## /m).find((p) => p.startsWith(`${title}\n`));
  return part ? part.slice(title.length + 1).trim() : "";
};

const readme = await Deno.readTextFile(README_PATH);

export default {
  license: section("license", readme),
};
