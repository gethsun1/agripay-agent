import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/health": "http://127.0.0.1:3001",
      "/ready": "http://127.0.0.1:3001",
    },
  },
  preview: { port: 4173 },
});
