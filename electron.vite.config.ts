import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    define: {
      "process.env.WS_NO_BUFFER_UTIL": '"true"',
      "process.env.WS_NO_UTF_8_VALIDATE": '"true"'
    },
    build: {
      rollupOptions: {
        input: "src/main/main.ts",
        output: {
          format: "cjs",
          entryFileNames: "main.cjs"
        }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: "src/main/preload.ts",
        output: {
          format: "cjs",
          entryFileNames: "preload.js"
        }
      }
    }
  },
  renderer: {
    root: "src/renderer",
    plugins: [react()]
  }
});
