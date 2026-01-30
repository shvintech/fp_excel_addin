import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import devCerts from "office-addin-dev-certs";
import { resolve } from "path";
import { copyFileSync } from "fs";

export default defineConfig(async ({ command }) => {
  return {
    plugins: [
      react(),
      // Custom plugin to copy manifest.xml after build
      {
        name: "copy-manifest",
        closeBundle() {
          try {
            copyFileSync(
              resolve(__dirname, "manifest.xml"),
              resolve(__dirname, "dist/manifest.xml")
            );
            console.log("✓ manifest.xml copied to dist folder");
          } catch (err) {
            console.error("Failed to copy manifest.xml:", err);
          }
        },
      },
    ],

    
    base: "/",

    publicDir: "assets",

    server: {
      https: command === "serve" ? await devCerts.getHttpsServerOptions() : undefined,
      port: 3000,
      host: "localhost",
      open: false,
    },

    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: {
          taskpane: resolve(__dirname, "taskpane.html"),
          commands: resolve(__dirname, "commands.html"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
          assetFileNames: "assets/[name][extname]",
        },
      },
    },

    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },

    define: {
      "process.env": {},
    },
  };
});
