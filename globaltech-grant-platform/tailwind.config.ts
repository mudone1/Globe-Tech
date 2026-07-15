import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: "#0E7A3A", // Globe-Tech green, sampled from the logo
        brandDark: "#054A26", // hover/pressed state, dark header fills
        brandDeep: "#032E16", // near-black green, used sparingly for depth
        ink: "#0B2A18", // primary text — dark green-black, on-brand but readable
        slate: "#4B5B52", // secondary text — green-gray
        paper: "#F5F8F5", // page background — warm off-white with a hint of green
        line: "#DCE6DE", // hairline borders
        gold: "#C8952A", // accent — reserved for the one thing that must stand out (the referral code)
        goldSoft: "#F4E7CE",
        good: "#1E7A4C",
        bad: "#B3392C",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
