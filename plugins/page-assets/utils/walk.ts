import { readdir, } from "node:fs/promises";
import path from "node:path";

/**
 * Recursively walk files in a directory using a async generator
 * @param dir Path to walk
 */
export async function* getFiles(dir: string,): AsyncGenerator<string> {
  const list = await readdir(dir, { withFileTypes: true, },);
  for (const item of list) {
    const itemPath = path.join(dir, item.name,);
    if (item.isDirectory()) {
      yield* getFiles(itemPath,);
    } else {
      yield itemPath;
    }
  }
}
