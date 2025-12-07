import { dirname, resolve, } from "node:path";
import { fileURLToPath, } from "node:url";
import { defineConfig, } from "vite";

const __filename = fileURLToPath(import.meta.url,);
const __dirname = dirname(__filename,);

export default defineConfig({
  css: {
    devSourcemap: true,
  },
  build: {
    outDir: resolve(__dirname, "dist",),
    emptyOutDir: false,
    sourcemap: "hidden",
    manifest: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/assets/scripts/main.ts",),
      },
      output: {
        assetFileNames: "assets/styles/[name].[hash].css",
        chunkFileNames: "assets/scripts/[name].[hash].js",
        entryFileNames: "assets/scripts/[name].[hash].js",
      },
    },
  },
  resolve: {
    alias: {
      "@assets": resolve(__dirname, "src/assets",),
    },
  },
},);
