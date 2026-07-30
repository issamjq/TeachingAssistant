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
  build: {
    rollupOptions: {
      output: {
        // React is the one dependency that never changes when we ship. Pinning
        // it to its own chunk means a deploy invalidates the app code and
        // leaves ~45 kB gzip of framework in the browser cache. Deliberately
        // narrow: grouping more libraries here would undo the route splitting
        // by pulling their importers back into one chunk.
        manualChunks: {
          react: ["react", "react-dom", "react-dom/client"],
        },
      },
    },
    // Set just above `mammoth` (488 kB raw), the largest chunk we ship. It is
    // lazy — only the .docx importer pulls it — so it is not a problem, but at
    // the 400 kB default it warned on every single build, and a warning that
    // always fires is one nobody reads. At 520 the next thing to trip this is
    // a real regression: a heavy view dragged back into a shared chunk by a
    // static import. The largest route chunk today is Landing at 134 kB raw.
    chunkSizeWarningLimit: 520,
  },
});
