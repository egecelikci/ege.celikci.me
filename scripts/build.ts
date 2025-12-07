// Helper to run shell commands
async function run(cmd: string[],) {
  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1,),
    stdout: "inherit",
    stderr: "inherit",
  },);
  const { code, } = await command.output();
  if (code !== 0) {
    throw new Error(`Command failed with code ${code}: ${cmd.join(" ",)}`,);
  }
}

console.log("Starting production build...",);

// 1. Clean
console.log("Cleaning...",);
// We can import the clean script logic or run it as a task.
// Let's run it as a task to keep it simple or just use the std lib here.
// But we already have a task.
await run(["deno", "task", "clean",],);

// 2. Build Vite (Assets)
console.log("Building Vite assets...",);
// We need to set NODE_ENV=production
// Deno.Command env option
const viteBuild = new Deno.Command("deno", {
  args: ["run", "-A", "npm:vite", "build",],
  env: { NODE_ENV: "production", },
  stdout: "inherit",
  stderr: "inherit",
},);
const viteRes = await viteBuild.output();
if (viteRes.code !== 0) throw new Error("Vite build failed",);

// 3. Build Eleventy (HTML)
console.log("Building Eleventy...",);
const eleventyBuild = new Deno.Command("deno", {
  args: ["run", "-A", "npm:@11ty/eleventy", "--config=eleventy.config.ts",],
  env: { NODE_ENV: "production", },
  stdout: "inherit",
  stderr: "inherit",
},);
const eleventyRes = await eleventyBuild.output();
if (eleventyRes.code !== 0) throw new Error("Eleventy build failed",);

// 4. Workbox
console.log("Generating Service Worker...",);
const workbox = new Deno.Command("deno", {
  args: ["run", "-A", "npm:workbox-cli", "generateSW", "workbox.config.cjs",],
  env: { NODE_ENV: "production", },
  stdout: "inherit",
  stderr: "inherit",
},);
const workboxRes = await workbox.output();
if (workboxRes.code !== 0) throw new Error("Workbox failed",);

// 5. Clean Vite temp files (if any logic needed)
// The yarn script had "clean:vite": "del-cli dist/.vite".
// We can do this with Deno.remove
try {
  await Deno.remove("./dist/.vite", { recursive: true, },);
} catch (e) {
  if (!(e instanceof Deno.errors.NotFound)) {
    console.warn("Could not remove dist/.vite", e,);
  }
}

console.log("Build complete!",);
