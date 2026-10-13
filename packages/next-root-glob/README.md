# Next ESLint Root Directory Matching

This private package adapts maintained `tinyglobby` and `picomatch` packages to
the `globSync(pattern, { onlyDirectories: true })` call consumed by
`@next/eslint-plugin-next`'s `getRootDirs` utility. The scoped npm override replaces
that plugin's `fast-glob` dependency and removes its unpatched `braces` chain.

The adapter preserves literal-directory matching, relative and absolute paths,
glob and brace patterns, and directory-only results with their explicit path form.
It does not implement or claim compatibility with the complete `fast-glob` API.
Contract tests exercise the installed Next ESLint consumer; review the call sites
when updating `eslint-config-next`.
