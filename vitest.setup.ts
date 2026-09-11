import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom ne fait aucune mise en page et n'implémente pas ResizeObserver : les
// composants qui mesurent leur conteneur gardent donc leur taille par défaut.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
});
