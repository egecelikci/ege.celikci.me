/**
 * Refreshes the İzmir vector tile extract the venue maps render, from Protomaps' daily OpenStreetMap build.
 *
 * @example
 * ```sh
 * deno task tiles
 * ```
 * @module
 */

import { exists } from "@std/fs/exists";

/** Extract region covering every venue the site lists, plus a margin. The order is minLon,minLat,maxLon,maxLat. */
const BBOX = "26.10,38.15,27.45,39.30";

/** Deepest zoom stored in the archive; the map overzooms past it. */
const MAX_ZOOM = 15;

const DIR = "src/assets/tiles";
const MAP_TS = "src/assets/scripts/common/map.ts";

/** The CLI is `pmtiles` from Homebrew, or `go-pmtiles` from `go install`. */
const CLI_NAMES = ["pmtiles", "go-pmtiles"];

const INSTALL =
  "Install it first: `brew install pmtiles`, or `go install github.com/protomaps/go-pmtiles@latest` with $(go env GOPATH)/bin on PATH.";

/** The extract `map.ts` points at; the filename carries a date so `/assets/*` can be cached immutably. */
const TILES_CONST = /const TILES = "\/assets\/tiles\/izmir-\d{8}\.pmtiles"/;

/**
 * Protomaps publishes one planet build per day.
 *
 * @param day - The build date as `YYYYMMDD`.
 * @returns The build URL.
 */
export const buildUrl = (day: string): string =>
  `https://build.protomaps.com/${day}.pmtiles`;

/**
 * Format a date as the `YYYYMMDD` stamp Protomaps uses, in UTC.
 *
 * @param date - The day.
 * @returns The stamp.
 */
export const dayStamp = (date: Date): string =>
  date.toISOString().slice(0, 10).replaceAll("-", "");

/**
 * Name the extract after the build it came from, so refreshing from an unchanged build does not rename an identical file.
 *
 * @param source - A Protomaps build URL.
 * @returns The extract filename, e.g. `izmir-20261006.pmtiles`.
 */
export function extractName(source: string): string {
  const day = source.match(/(\d{8})\.pmtiles$/)?.[1];
  if (!day) throw new Error(`Not a Protomaps build URL: ${source}`);
  return `izmir-${day}.pmtiles`;
}

/**
 * Point `map.ts` at a new extract.
 *
 * @param source - The contents of `map.ts`.
 * @param url - The site path of the new extract.
 * @returns The updated contents (unchanged when already current), or `null` when the `TILES` constant is not found.
 */
export function pointMapAt(source: string, url: string): string | null {
  if (!TILES_CONST.test(source)) return null;
  return source.replace(TILES_CONST, `const TILES = "${url}"`);
}

/**
 * List the extracts to delete once a new one is in place.
 *
 * @param names - Filenames in the tiles folder.
 * @param keep - The current extract.
 * @returns Older `izmir-*.pmtiles` extracts, including leftover partial downloads.
 */
export function staleExtracts(names: string[], keep: string): string[] {
  return names.filter((name) =>
    name !== keep && /^izmir-\d{8}\.pmtiles(\.part)?$/.test(name)
  );
}

/**
 * Find the newest Protomaps build, which can lag today by a day or two.
 *
 * @param fetcher - Injectable for tests.
 * @param now - Injectable for tests.
 * @returns The newest build URL that answers.
 */
export async function newestBuild(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<string> {
  for (let back = 0; back <= 5; back++) {
    const url = buildUrl(dayStamp(new Date(now.getTime() - back * 86_400_000)));
    try {
      const res = await fetcher(url, { headers: { Range: "bytes=0-15" } });
      await res.body?.cancel();
      if (res.ok) return url;
    } catch {
      // Try the previous day.
    }
  }
  throw new Error("No Protomaps build found in the last six days.");
}

/** Find the pmtiles CLI by running it, which works the same on every platform. */
async function findCli(): Promise<string | undefined> {
  for (const name of CLI_NAMES) {
    try {
      await new Deno.Command(name, {
        args: ["version"],
        stdout: "null",
        stderr: "null",
      }).output();
      return name;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
}

if (import.meta.main) {
  const cli = await findCli();
  if (!cli) {
    console.error(`pmtiles CLI not found on PATH. ${INSTALL}`);
    Deno.exit(1);
  }

  const source = await newestBuild();
  const name = extractName(source);
  const output = `${DIR}/${name}`;
  const url = `/${DIR.replace(/^src\//, "")}/${name}`;

  if (await exists(output)) {
    console.log(`${output} is already the newest build.`);
  } else {
    console.log(`Extracting ${source} -> ${output}`);
    await Deno.mkdir(DIR, { recursive: true });
    // Extract next to the target and rename on success, so an interrupted run never leaves a partial file that looks finished.
    const partial = `${output}.part`;
    const status = await new Deno.Command(cli, {
      args: [
        "extract",
        source,
        partial,
        `--bbox=${BBOX}`,
        `--maxzoom=${MAX_ZOOM}`,
      ],
      stdout: "inherit",
      stderr: "inherit",
    }).spawn().status;
    if (!status.success) {
      await Deno.remove(partial).catch(() => {});
      console.error(`extract failed with exit code ${status.code}`);
      Deno.exit(1);
    }
    await Deno.rename(partial, output);
  }

  // Repoint the map before deleting anything, so a failure here never leaves it aimed at a removed file.
  const updated = pointMapAt(await Deno.readTextFile(MAP_TS), url);
  if (updated === null) {
    console.error(
      `${MAP_TS} has no TILES constant to update; set it to "${url}" by hand.`,
    );
    Deno.exit(1);
  }
  await Deno.writeTextFile(MAP_TS, updated);

  const names = [];
  for await (const entry of Deno.readDir(DIR)) {
    if (entry.isFile) names.push(entry.name);
  }
  for (const stale of staleExtracts(names, name)) {
    console.log(`Removing older extract ${stale}`);
    await Deno.remove(`${DIR}/${stale}`);
  }

  console.log(
    `Map points at ${url}. Next: git add ${DIR} ${MAP_TS} and commit.`,
  );
}
