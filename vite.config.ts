import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  cacheDir: "node_modules/.vite",
  server: {
    host: "127.0.0.1",
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
});
