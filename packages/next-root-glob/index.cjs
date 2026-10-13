const path = require('node:path')
const fs = require('node:fs')
const { globSync: tinyGlobSync, isDynamicPattern } = require('tinyglobby')
const picomatch = require('picomatch')

function normalize(value) {
  const normalized = value.replace(/\\/g, '/')
  const root = path.parse(value).root.replace(/\\/g, '/')
  return normalized === root ? normalized : normalized.replace(/\/$/, '')
}

// Next ESLint consumes only globSync(pattern, { onlyDirectories: true }).
function globSync(patterns, options) {
  if (
    options?.onlyDirectories !== true ||
    Object.keys(options).some((key) => key !== 'onlyDirectories')
  ) {
    throw new TypeError('Next root directory matching requires onlyDirectories: true')
  }

  const inputs = Array.isArray(patterns) ? patterns : [patterns]
  if (inputs.some((pattern) => typeof pattern !== 'string' || pattern.length === 0)) {
    throw new TypeError('Patterns must be a string (non empty) or an array of strings')
  }
  const excludes = inputs.filter((pattern) => pattern.startsWith('!') && !pattern.startsWith('!('))
  const excluded = excludes.map((pattern) =>
    picomatch(normalize(path.resolve(pattern.slice(1))), { strictSlashes: true })
  )
  const results = new Set()

  for (const pattern of inputs) {
    if (excludes.includes(pattern)) continue
    const normalizedPattern = normalize(path.resolve(pattern))
    const matches = picomatch(normalizedPattern, { strictSlashes: true })
    if (!isDynamicPattern(pattern)) {
      const isExcluded = excluded.some(
        (exclude) => exclude(normalizedPattern) || exclude(`${normalizedPattern}/`)
      )
      try {
        if (!isExcluded && fs.statSync(normalizedPattern).isDirectory()) results.add(pattern)
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
      }
      continue
    }
    const directories = tinyGlobSync(normalizedPattern, {
      onlyDirectories: true,
      expandDirectories: false,
      absolute: true,
    })

    for (const directory of directories) {
      const normalizedDirectory = normalize(directory)
      if (
        !matches(normalizedDirectory) ||
        excluded.some(
          (exclude) => exclude(normalizedDirectory) || exclude(`${normalizedDirectory}/`)
        )
      ) {
        continue
      }
      const relative = path.relative(process.cwd(), normalizedDirectory) || '.'
      const result = path.isAbsolute(pattern)
        ? normalizedDirectory
        : pattern.startsWith('./')
          ? `./${relative}`
          : relative
      results.add(result)
    }
  }

  return [...results]
}

module.exports = { globSync }
