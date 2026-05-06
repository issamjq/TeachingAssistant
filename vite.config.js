import "dotenv/config";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { buildApp } from "./backend/app.js";

// In dev, mount the same Express app the standalone Render server uses.
// One source of truth for /api/* routes — no behaviour drift between dev
// and prod.
const apiPlugin = {
  name: "mudir-api",
  configureServer(server) {
    const app = buildApp();
    server.middlewares.use(app);
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
