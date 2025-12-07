import { constants, } from "node:fs";
import fs from "node:fs/promises";

export default async function resolveFile(filePath: string,): Promise<boolean> {
  try {
    await fs.access(filePath, constants.F_OK,);
    return true;
  } catch (error) {
    console.error(`Error resolving file ${filePath}:`, error,);
    return false;
  }
}
