import "dotenv/config";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { buildApp } from "./backend/app.js";
import { validateEnv } from "./backend/lib/env.js";

// In dev, mount the same Express app the standalone Render server uses.
// One source of truth for /api/* routes — no behaviour drift between dev
// and prod. We validate the env BEFORE mounting so a broken local .env
// shows up immediately, not at the first /api/* call.
const apiPlugin = {
  name: "murchid-api",
  configureServer(server) {
    validateEnv();
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
