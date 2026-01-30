import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync } from "fs";

async function getHttpsOptions() {
  const isCI = process.env.CI || process.env.VERCEL; // Check for CI/Vercel environment
  if (isCI) {
    return undefined;
  }

  try {
    const devCerts = await import("office-addin-dev-certs");
    return await devCerts.getHttpsServerOptions();
  } catch (error) {
    console.warn("Unable to load HTTPS options from office-addin-dev-certs:", error);
    return undefined;
  }
}

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
      https: command === "serve" ? await getHttpsOptions() : undefined,
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
