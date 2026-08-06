// Tailwind v4 under Next.js goes through PostCSS, not the Vite plugin
// (@tailwindcss/vite, which is what vite.config.js used).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
