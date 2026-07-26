import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#05050a",
          glow: "#1a0b2e",
          cyan: "#7dffea",
          purple: "#b16dff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
