// Start script for Dev
// Runs Eleventy (Serve) and Vite (Dev) in parallel.

console.log("Starting Dev Server...",);

// 1. Eleventy Serve
// eleventy --serve
const eleventy = new Deno.Command("deno", {
  args: [
    "run",
    "-A",
    "npm:@11ty/eleventy",
    "--serve",
    "--config=eleventy.config.ts",
  ],
  stdout: "inherit",
  stderr: "inherit",
},);
const eleventyProcess = eleventy.spawn();

// 2. Vite Dev
// vite
const vite = new Deno.Command("deno", {
  args: ["run", "-A", "npm:vite",],
  stdout: "inherit",
  stderr: "inherit",
},);
const viteProcess = vite.spawn();

// Handle exit
const signals = ["SIGINT", "SIGTERM",];
for (const signal of signals) {
  Deno.addSignalListener(signal as Deno.Signal, () => {
    console.log("Stopping...",);
    eleventyProcess.kill();
    viteProcess.kill();
    Deno.exit(0,);
  },);
}

// Wait for both? No, usually we just let them run.
// If one crashes, we might want to kill the other.
const status1 = await eleventyProcess.status;
const status2 = await viteProcess.status;

console.log(`Eleventy exited with ${status1.code}`,);
console.log(`Vite exited with ${status2.code}`,);
Deno.exit(status1.code || status2.code,);
