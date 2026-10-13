/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': { optimize: false },
    '@replenops/tailwind-compatibility': {},
  },
}

export default config
