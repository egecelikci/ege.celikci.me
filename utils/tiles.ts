/**
 * Refreshes the İzmir vector tile extract the venue maps render, from Protomaps' daily OpenStreetMap build.
 *
 * @example
 * ```sh
 * deno task tiles
 * ```
 */

/** Extract region covering every venue the site lists, plus a margin. The order is minLon,minLat,maxLon,maxLat. */
const BBOX = "26.10,38.15,27.45,39.30";

/** Deepest zoom stored in the archive; the map overzooms past it. */
const MAX_ZOOM = 15;

const DIR = "src/assets/tiles";
const MAP_TS = "src/assets/scripts/common/map.ts";

/** Protomaps publishes one planet build per day. */
const buildUrl = (day: string) => `https://build.protomaps.com/${day}.pmtiles`;

/** The CLI is `pmtiles` from Homebrew, or `go-pmtiles` from `go install`. */
const CLI_NAMES = ["pmtiles", "go-pmtiles"];

const INSTALL =
  "Install it first: `brew install pmtiles`, or `GOBIN=/tmp/bin go install github.com/protomaps/go-pmtiles@latest`.";

const today = () => new Date().toISOString().slice(0, 10).replaceAll("-", "");

function findCli(): string | undefined {
  return CLI_NAMES.find((name) => {
    try {
      const { code } = new Deno.Command("sh", {
        args: ["-c", `command -v ${name}`],
        stdout: "null",
        stderr: "null",
      }).outputSync();
      return code === 0;
    } catch {
      return false;
    }
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/** The newest build can lag today by a day or two, so walk back until one answers. */
async function newestBuild(): Promise<string> {
  for (let back = 0; back <= 5; back++) {
    const url = buildUrl(
      new Date(Date.now() - back * 86_400_000)
        .toISOString()
        .slice(0, 10)
        .replaceAll("-", ""),
    );
    try {
      const res = await fetch(url, { headers: { Range: "bytes=0-15" } });
      if (res.ok || res.status === 206) return url;
    } catch {
      // try the previous day
    }
  }
  throw new Error("No Protomaps build found in the last six days.");
}

const cli = findCli();
if (!cli) {
  console.error(`pmtiles CLI not found on PATH. ${INSTALL}`);
  Deno.exit(1);
}

const name = `izmir-${today()}.pmtiles`;
const output = `${DIR}/${name}`;

if (await exists(output)) {
  console.log(`${output} already exists, nothing to do.`);
  Deno.exit(0);
}

const source = await newestBuild();
console.log(`Extracting ${source} -> ${output}`);
await Deno.mkdir(DIR, { recursive: true });

const status = await new Deno.Command(cli, {
  args: ["extract", source, output, `--bbox=${BBOX}`, `--maxzoom=${MAX_ZOOM}`],
  stdout: "inherit",
  stderr: "inherit",
}).spawn().status;

if (!status.success) {
  console.error(`extract failed with exit code ${status.code}`);
  Deno.exit(1);
}

/** Only the current extract should ship, so older ones go. */
for await (const entry of Deno.readDir(DIR)) {
  if (entry.isFile && entry.name.startsWith("izmir-") && entry.name !== name) {
    console.log(`Removing older extract ${entry.name}`);
    await Deno.remove(`${DIR}/${entry.name}`);
  }
}

/** The filename carries the date because `/assets/*` is cached immutably, so the map has to be pointed at the new one. */
const url = `/${DIR.replace(/^src\//, "")}/${name}`;
const mapTs = await Deno.readTextFile(MAP_TS);
const updated = mapTs.replace(
  /const TILES = "\/assets\/tiles\/izmir-\d{8}\.pmtiles"/,
  `const TILES = "${url}"`,
);

if (updated === mapTs) {
  console.error(
    `${MAP_TS} was not updated; set its TILES constant to "${url}" by hand.`,
  );
  Deno.exit(1);
}

await Deno.writeTextFile(MAP_TS, updated);
console.log(`Updated ${MAP_TS} to ${url}`);
console.log(`Next: git add ${DIR} ${MAP_TS} and commit.`);
