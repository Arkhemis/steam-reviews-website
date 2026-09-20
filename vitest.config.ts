import react from "@vitejs/plugin-react";
import { config } from "dotenv";
import { defaultExclude, defineConfig } from "vitest/config";

// Next.js charge .env.local automatiquement ; Vitest non, donc on le fait
// nous-mêmes pour que les tests qui tapent marts.game_stats via `pg` se
// connectent à la même base que `next dev`.
config({ path: ".env.local" });

export default defineConfig({
  plugins: [react()],
  test: {
    // Les agents créent des worktrees sous `.claude/`, chacun avec son propre
    // `node_modules` : sans cette exclusion, Vitest ramasse leurs tests et les
    // fait tourner contre un second exemplaire de React, dont les hooks
    // explosent (`Cannot read properties of null`).
    exclude: [...defaultExclude, "**/.claude/**"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
