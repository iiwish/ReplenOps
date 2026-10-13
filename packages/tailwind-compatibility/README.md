# ReplenOps CSS Compatibility

This private PostCSS plugin preserves the application's established CSS contract
with Tailwind CSS 4 and Ant Design. It keeps unlayered cascade precedence,
sibling-based space/divide utilities, ring opacity, transparent accessible outlines,
field backgrounds and placeholders, hidden-element precedence,
and the configured centered container with 2rem padding and a 1400px maximum.

The plugin uses PostCSS's AST API after `@tailwindcss/postcss`, with Tailwind's
internal optimization disabled. Next.js performs production CSS optimization.
Compiled CSS tests and browser screenshot comparisons cover these contracts.
Review the compiler output and these tests when upgrading Tailwind CSS.
