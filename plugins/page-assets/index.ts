import { JSDOM, } from "jsdom";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import pm from "picomatch";
import hashFile from "./utils/hashFile.ts";
import resolveFile from "./utils/resolveFile.ts";
import { getFiles, } from "./utils/walk.ts";

const PREFIX = "Eleventy-Plugin-Page-Assets";
const LOG_PREFIX = `[\x1b[34m${PREFIX}\x1b[0m]`;

interface PluginOptions {
  mode: "directory" | "parse";
  postsMatching: string;
  assetsMatching: string;
  recursive: boolean;
  hashAssets: boolean;
  hashingAlg: string;
  hashingDigest: string;
  addIntegrityAttribute: boolean;
  silent: boolean;
}

const defaultOptions: PluginOptions = {
  mode: "parse",
  postsMatching: "*.md",
  assetsMatching: "*.png|*.jpg|*.gif",
  recursive: false,
  hashAssets: true,
  hashingAlg: "sha1",
  hashingDigest: "hex",
  addIntegrityAttribute: true,
  silent: false,
};

const isRelative = (url: string,) => !/^https?:/.test(url,);

export default function(
  eleventyConfig: any,
  options: Partial<PluginOptions> = {},
) {
  const pluginOptions = { ...defaultOptions, ...options, };

  async function transformParser(
    this: any,
    content: string,
    outputPath: string,
  ) {
    const template = this;
    if (outputPath && outputPath.endsWith(".html",)) {
      const inputPath = template.inputPath;

      if (
        pm.isMatch(inputPath, pluginOptions.postsMatching, {
          contains: true,
        },)
      ) {
        const templateDir = path.dirname(template.inputPath,);
        const outputDir = path.dirname(outputPath,);

        // parse
        const dom = new JSDOM(content,);
        const doc = dom.window.document;
        const elms = [...doc.querySelectorAll("img",),] as HTMLImageElement[];

        if (!pluginOptions.silent) {
          console.log(
            LOG_PREFIX,
            `Found ${elms.length} assets in ${outputPath} from template ${inputPath}`,
          );
        }

        await Promise.all(
          elms.map(async (img,) => {
            const src = img.getAttribute("src",);
            if (
              src
              && isRelative(src,)
              && pm.isMatch(src, pluginOptions.assetsMatching, {
                contains: true,
              },)
            ) {
              const assetPath = path.join(templateDir, src,);
              const assetSubdir = path.relative(
                templateDir,
                path.dirname(assetPath,),
              );
              const assetBasename = path.basename(assetPath,);

              let destDir = path.join(outputDir, assetSubdir,);
              let destPath = path.join(destDir, assetBasename,);
              let destPathRelativeToPage = path.join(
                "./",
                assetSubdir,
                assetBasename,
              );

              // resolve asset
              if (await resolveFile(assetPath,)) {
                // calculate hash
                if (pluginOptions.hashAssets) {
                  const hash = await hashFile(
                    assetPath,
                    pluginOptions.hashingAlg,
                    pluginOptions.hashingDigest as any,
                  );
                  if (pluginOptions.addIntegrityAttribute) {
                    img.setAttribute(
                      "integrity",
                      `${pluginOptions.hashingAlg}-${hash}`,
                    );
                  }

                  // rewrite paths
                  destDir = outputDir; // flatten subdir
                  destPath = path.join(
                    destDir,
                    hash + path.extname(assetBasename,),
                  );
                  destPathRelativeToPage = "./"
                    + path.join(hash + path.extname(assetBasename,),);
                  img.setAttribute("src", destPathRelativeToPage,);
                }

                if (!pluginOptions.silent) {
                  console.log(
                    LOG_PREFIX,
                    `Writing ./${destPath} from ./${assetPath}`,
                  );
                }

                fs.mkdirSync(destDir, { recursive: true, },);
                await fsPromises.copyFile(assetPath, destPath,);
              } else {
                console.error(
                  `${LOG_PREFIX} Cannot resolve asset "${src}" in "${outputPath}" from template "${inputPath}"!`,
                );
              }
            }
          },),
        );

        if (!pluginOptions.silent) {
          console.log(
            LOG_PREFIX,
            `Processed ${elms.length} images in "${outputPath}" from template "${inputPath}"`,
          );
        }
        content = dom.serialize();
      }
    }
    return content;
  }

  async function transformDirectoryWalker(
    this: any,
    content: string,
    outputPath: string,
  ) {
    const template = this;
    if (outputPath && outputPath.endsWith(".html",)) {
      const inputPath = template.inputPath;

      if (
        pm.isMatch(inputPath, pluginOptions.postsMatching, {
          contains: true,
        },)
      ) {
        const templateDir = path.dirname(template.inputPath,);
        const outputDir = path.dirname(outputPath,);

        let assets: string[] = [];
        if (pluginOptions.recursive) {
          for await (const file of getFiles(templateDir,)) {
            assets.push(file,);
          }
        } else {
          const files = await fsPromises.readdir(templateDir,);
          assets = files.map((f,) => path.join(templateDir, f,));
        }
        assets = assets.filter((file,) =>
          pm.isMatch(file, pluginOptions.assetsMatching, {
            contains: true,
          },)
        );

        if (assets.length) {
          for (const file of assets) {
            const relativeSubDir = path.relative(
              templateDir,
              path.dirname(file,),
            );
            const basename = path.basename(file,);

            const from = file;
            const destDir = path.join(outputDir, relativeSubDir,);
            const dest = path.join(destDir, basename,);

            fs.mkdirSync(destDir, { recursive: true, },);
            if (!pluginOptions.silent) {
              console.log(LOG_PREFIX, `Moved ${from} to ${dest}`,);
            }
            await fsPromises.copyFile(from, dest,);
          }
        }
      }
    }
    return content;
  }

  if (pluginOptions.mode === "parse") {
    // html parser
    eleventyConfig.addTransform(`${PREFIX}-transform-parser`, transformParser,);
  } else if (pluginOptions.mode === "directory") {
    // directory traverse
    eleventyConfig.addTransform(
      `${PREFIX}-transform-traverse`,
      transformDirectoryWalker,
    );
  } else {
    throw new Error(
      `${LOG_PREFIX} Invalid mode! Allowed modes: parse|directory`,
    );
  }
}
