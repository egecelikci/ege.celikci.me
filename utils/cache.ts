import { ensureDir, } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join, } from "https://deno.land/std@0.224.0/path/mod.ts";

const CACHE_DIR = "_cache";

// Helper to replace the deprecated 'exists' function
async function fileExists(path: string,): Promise<boolean> {
  try {
    await Deno.stat(path,);
    return true;
  } catch {
    return false;
  }
}

interface FetchOptions extends RequestInit {
  duration?: string;
  type?: "json" | "buffer" | "text";
  directory?: string;
  filenameFormat?: () => string;
}

export async function cachedFetch(url: string, options: FetchOptions = {},) {
  const duration = options.duration || "1d";
  const type = options.type || "text";
  const directory = options.directory || CACHE_DIR;

  // Generate filename (hash or custom)
  const urlHash = options.filenameFormat
    ? options.filenameFormat()
    : btoa(url,).replace(/[^a-z0-9]/gi, "",).slice(0, 16,);

  const ext = type === "json"
    ? ".json"
    : (type === "buffer" ? ".buffer" : ".txt");
  const filePath = join(directory, urlHash + ext,);

  // Ensure cache directory exists
  await ensureDir(directory,);

  // Check cache validity
  if (await fileExists(filePath,)) {
    if (duration !== "0s") {
      const content = await Deno.readFile(filePath,);
      if (type === "json") {
        return JSON.parse(new TextDecoder().decode(content,),);
      }
      if (type === "buffer") return content;
      return new TextDecoder().decode(content,);
    }
  }

  // Fetch fresh data
  console.log(`[Cache] Miss: ${url}`,);
  const response = await fetch(url, options,);

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`,);
  }

  let data;
  let fileContent;

  if (type === "json") {
    data = await response.json();
    fileContent = new TextEncoder().encode(JSON.stringify(data, null, 2,),);
  } else if (type === "buffer") {
    const arrayBuffer = await response.arrayBuffer();
    data = new Uint8Array(arrayBuffer,);
    fileContent = data;
  } else {
    data = await response.text();
    fileContent = new TextEncoder().encode(data,);
  }

  // Save to cache
  await Deno.writeFile(filePath, fileContent,);

  return data;
}
