import { defineConfig } from "vite";
export default defineConfig({
  base: "./", // На Pages адрес включает название репозитория.
  build: { outDir: "docs" },
  esbuild: { jsx: "automatic" },
});
