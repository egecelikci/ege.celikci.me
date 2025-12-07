import { memoize, } from "lodash-es";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_ENTRY_FILE = "src/assets/scripts/main.ts";
const PATH_PREFIX = "/";

interface ManifestChunk {
  file: string;
  src?: string;
  isEntry?: boolean;
  css?: string[];
  [key: string]: unknown;
}

type Manifest = Record<string, ManifestChunk>;

const getAssetManifest = memoize(async function(): Promise<Manifest> {
  const manifestPath = path.resolve(
    process.cwd(),
    "dist/.vite",
    "manifest.json",
  );
  const manifestContent = await fs.readFile(manifestPath, "utf-8",);
  return JSON.parse(manifestContent,);
},);

async function getChunkInformationFor(
  entryFilename: string,
): Promise<ManifestChunk> {
  // We want an entryFilename, because in practice you might have multiple entrypoints
  // This is similar to how you specify an entry in development more
  if (!entryFilename) {
    throw new Error(
      "You must specify an entryFilename, so that vite-script can find the correct file.",
    );
  }

  const manifest = await getAssetManifest();
  const entryChunk = manifest[entryFilename];

  if (!entryChunk) {
    const possibleEntries = (Object.values(manifest,) as ManifestChunk[])
      .filter((chunk: ManifestChunk,) => chunk.isEntry === true)
      .map((chunk: ManifestChunk,) => `"${chunk.src}"`)
      .join(`, `,);
    throw new Error(
      `No entry for ${entryFilename} found in dist/.vite/manifest.json. Valid entries in manifest: ${possibleEntries}`,
    );
  }

  return entryChunk;
}

async function viteScriptTag(entryFilename?: string,): Promise<string> {
  const entryFile = entryFilename || DEFAULT_ENTRY_FILE;
  const entryChunk = await getChunkInformationFor(entryFile,);
  return `<script type="module" src="${PATH_PREFIX}${entryChunk.file}"></script>`;
}

async function viteLinkStylesheetTags(
  entryFilename?: string,
): Promise<string> {
  const entryFile = entryFilename || DEFAULT_ENTRY_FILE;
  const entryChunk = await getChunkInformationFor(entryFile,);
  if (!entryChunk.css || entryChunk.css.length === 0) {
    // Only warn if we expected CSS but didn't find any? Or maybe silence it.
    // console.warn(`No css found for ${entryFilename} entry. Is that correct?`);
    return "";
  }
  /* There can be multiple CSS files per entry, so assume many by default */
  return entryChunk.css
    .map(
      (cssFile,) =>
        `<link rel="stylesheet" href="${PATH_PREFIX}${cssFile}"></link>`,
    )
    .join("\n",);
}

export default {
  viteScriptTag,
  viteLinkStylesheetTags,
};
