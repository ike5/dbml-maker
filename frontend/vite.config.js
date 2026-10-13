import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Django must see the original Host header, because it examines the CSRF
// origin against the host. For this reason, changeOrigin is false (§16.1).
const toDjango = { target: "http://localhost:8000", changeOrigin: false };

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // The dev server uses "/". Only the build uses the path that WhiteNoise serves.
  base: command === "build" ? "/static/" : "/",
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": toDjango,
      "/_allauth": toDjango,
      "/admin": toDjango,
      "/static": toDjango,
    },
  },
  worker: { format: "es" },
  define: {
    __APP_RELEASE__: JSON.stringify(process.env.APP_RELEASE ?? "dev"),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
  },
}));
