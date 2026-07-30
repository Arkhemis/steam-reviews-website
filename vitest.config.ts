import react from "@vitejs/plugin-react";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Next.js charge .env.local automatiquement ; Vitest non, donc on le fait
// nous-mêmes pour que les tests qui tapent marts.game_stats via `pg` se
// connectent à la même base que `next dev`.
config({ path: ".env.local" });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
