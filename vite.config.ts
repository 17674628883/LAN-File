import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src/mobile",
  base: "/mobile/",
  build: {
    outDir: "../../out/mobile",
    emptyOutDir: true
  }
});
