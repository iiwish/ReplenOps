import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { ESLint } from 'eslint'
import postcss, { type Root } from 'postcss'
import postcssConfig from '../../postcss.config.mjs'

const require = createRequire(import.meta.url)
const pluginRequire = createRequire(require.resolve('@next/eslint-plugin-next'))
const { globSync } = pluginRequire('fast-glob') as {
  globSync: (
    patterns: string | string[],
    options: { onlyDirectories: true } & Record<string, unknown>
  ) => string[]
}
const { getRootDirs } = pluginRequire('./utils/get-root-dirs') as {
  getRootDirs: (context: {
    cwd: string
    settings: { next?: { rootDir?: string | (string | number)[] } }
  }) => string[]
}

let fixtureDirectory: string

describe('Next ESLint root directory matching', () => {
  beforeAll(async () => {
    fixtureDirectory = await mkdtemp(path.join(tmpdir(), 'replenops-root-dirs-'))
    await mkdir(path.join(fixtureDirectory, 'apps', 'admin', 'src'), { recursive: true })
    await mkdir(path.join(fixtureDirectory, 'apps', 'store', 'src'), { recursive: true })
    await mkdir(path.join(fixtureDirectory, 'apps', '.hidden'), { recursive: true })
    await writeFile(path.join(fixtureDirectory, 'apps', 'README.md'), 'fixture')
    await symlink(
      path.join(fixtureDirectory, 'apps', 'admin'),
      path.join(fixtureDirectory, 'linked-admin')
    )
  })

  afterAll(async () => {
    await rm(fixtureDirectory, { recursive: true, force: true })
  })

  it('matches only a literal directory, not all of its descendants', () => {
    const directory = path.join(fixtureDirectory, 'apps', 'admin')
    expect(globSync(directory, { onlyDirectories: true })).toEqual([directory])
  })

  it('preserves the native filesystem root', () => {
    const root = path.parse(process.cwd()).root
    expect(globSync(root, { onlyDirectories: true })).toEqual([root])
  })

  it('preserves dot, relative prefixes and explicit trailing separators', () => {
    expect(globSync('.', { onlyDirectories: true })).toEqual(['.'])
    expect(globSync('./', { onlyDirectories: true })).toEqual(['./'])
    const relative = path.relative(process.cwd(), path.join(fixtureDirectory, 'apps', 'admin'))
    expect(globSync(relative, { onlyDirectories: true })).toEqual([relative])
    expect(globSync(`./${relative}/`, { onlyDirectories: true })).toEqual([`./${relative}/`])
  })

  it('matches recursive relative globs without including the base directory', () => {
    const relative = path.relative(process.cwd(), path.join(fixtureDirectory, 'apps'))
    expect(globSync(`${relative}/**`, { onlyDirectories: true }).sort()).toEqual([
      `${relative}/admin`,
      `${relative}/admin/src`,
      `${relative}/store`,
      `${relative}/store/src`,
    ])
  })

  it('includes explicit dot directories and symlinks, but not files or missing roots', () => {
    const hidden = path.join(fixtureDirectory, 'apps', '.hidden')
    const linked = path.join(fixtureDirectory, 'linked-admin')
    expect(globSync(hidden, { onlyDirectories: true })).toEqual([hidden])
    expect(globSync(linked, { onlyDirectories: true })).toEqual([linked])
    expect(
      globSync(path.join(fixtureDirectory, 'apps', 'README.md'), { onlyDirectories: true })
    ).toEqual([])
    expect(globSync(path.join(fixtureDirectory, 'missing'), { onlyDirectories: true })).toEqual([])
  })

  it('preserves absolute paths and omits files and hidden directories', () => {
    expect(globSync(`${fixtureDirectory}/apps/*`, { onlyDirectories: true }).sort()).toEqual([
      path.join(fixtureDirectory, 'apps', 'admin'),
      path.join(fixtureDirectory, 'apps', 'store'),
    ])
  })

  it('supports braces and arrays without trailing separators', () => {
    expect(
      globSync(`${fixtureDirectory}/apps/{admin,store}`, { onlyDirectories: true }).sort()
    ).toEqual([
      path.join(fixtureDirectory, 'apps', 'admin'),
      path.join(fixtureDirectory, 'apps', 'store'),
    ])
    expect(
      globSync(
        [path.join(fixtureDirectory, 'apps', 'admin'), path.join(fixtureDirectory, 'missing')],
        { onlyDirectories: true }
      )
    ).toEqual([path.join(fixtureDirectory, 'apps', 'admin')])
  })

  it('supports exclusions and extglobs', () => {
    expect(
      globSync([`${fixtureDirectory}/apps/*`, `!${fixtureDirectory}/apps/admin`], {
        onlyDirectories: true,
      })
    ).toEqual([path.join(fixtureDirectory, 'apps', 'store')])
    expect(
      globSync([`${fixtureDirectory}/apps/**`, `!${fixtureDirectory}/apps/admin/**`], {
        onlyDirectories: true,
      }).sort()
    ).toEqual([
      path.join(fixtureDirectory, 'apps', 'store'),
      path.join(fixtureDirectory, 'apps', 'store', 'src'),
    ])
    expect(
      globSync(`${fixtureDirectory}/apps/@(admin|store)`, { onlyDirectories: true }).sort()
    ).toEqual([
      path.join(fixtureDirectory, 'apps', 'admin'),
      path.join(fixtureDirectory, 'apps', 'store'),
    ])
  })

  it('rejects empty patterns rather than treating them as the project root', () => {
    expect(() => globSync('', { onlyDirectories: true })).toThrow(TypeError)
  })

  it('rejects unsupported options instead of silently changing future consumers', () => {
    expect(() => globSync('.', { onlyDirectories: true, cwd: fixtureDirectory })).toThrow(
      'onlyDirectories: true'
    )
  })

  it('preserves Next lint default, single-root and multi-root settings', () => {
    expect(getRootDirs({ cwd: fixtureDirectory, settings: {} })).toEqual([fixtureDirectory])
    expect(
      getRootDirs({
        cwd: fixtureDirectory,
        settings: { next: { rootDir: `${fixtureDirectory}/apps/*` } },
      }).sort()
    ).toEqual([
      path.join(fixtureDirectory, 'apps', 'admin'),
      path.join(fixtureDirectory, 'apps', 'store'),
    ])
    expect(
      getRootDirs({
        cwd: fixtureDirectory,
        settings: {
          next: {
            rootDir: [
              path.join(fixtureDirectory, 'apps', 'admin'),
              path.join(fixtureDirectory, 'missing'),
              1,
            ],
          },
        },
      })
    ).toEqual([path.join(fixtureDirectory, 'apps', 'admin')])
  })

  it('keeps the actual Next link rule active for configured roots', async () => {
    const pages = path.join(fixtureDirectory, 'apps', 'admin', 'pages')
    await mkdir(pages)
    await writeFile(
      path.join(pages, 'about.tsx'),
      'export default function About() { return null }'
    )
    const nextPlugin = pluginRequire('./index') as ESLint.Plugin
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.jsx'],
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          plugins: { '@next/next': nextPlugin },
          settings: { next: { rootDir: path.join(fixtureDirectory, 'apps', 'admin') } },
          rules: { '@next/next/no-html-link-for-pages': 'error' },
        },
      ],
    })

    const [result] = await eslint.lintText('<a href="/about">About</a>', {
      filePath: 'fixture.jsx',
    })
    expect(result?.messages).toMatchObject([
      { ruleId: '@next/next/no-html-link-for-pages', severity: 2 },
    ])
  })
})

describe('dependency security graph', () => {
  it('removes the unpatched braces and micromatch dependency chain', async () => {
    const lock = JSON.parse(await readFile(path.resolve('package-lock.json'), 'utf8')) as {
      packages: Record<string, { version?: string }>
    }
    expect(
      Object.keys(lock.packages).filter((name) =>
        /\/node_modules\/(braces|micromatch)$/.test(`/${name}`)
      )
    ).toEqual([])
  })
})

describe('CSS toolchain compatibility', () => {
  let compiled: Root

  beforeAll(async () => {
    const source = path.resolve('src/app/globals.css')
    const css = await readFile(source, 'utf8')
    const plugins = Object.entries(postcssConfig.plugins).map(([name, options]) => {
      const plugin = require(name) as (options: unknown) => import('postcss').Plugin
      return plugin(options)
    })
    const result = await postcss(plugins).process(
      `${css}\n@source inline('container p-4 shadow-sm rounded outline-none space-y-4 sm:space-x-2 focus:ring-opacity-75 animate-in animate-out animate-accordion-down');\n@layer components { .compatibility-fixture { padding: 3rem; } }`,
      { from: source }
    )
    compiled = result.root
  })

  function declarations(selector: string | RegExp) {
    const values = new Map<string, string>()
    compiled.walkRules(selector, (rule) => {
      rule.walkDecls((declaration) => {
        values.set(declaration.prop, declaration.value)
      })
    })
    return values
  }

  it('retains unlayered component precedence below utility overrides and print rules', () => {
    const layers: string[] = []
    compiled.walkAtRules('layer', (rule) => {
      layers.push(rule.params)
    })
    expect(layers).toEqual([])
    const rules: string[] = []
    compiled.walkRules((rule) => {
      rules.push(rule.selector)
    })
    expect(rules.indexOf('.compatibility-fixture')).toBeLessThan(rules.indexOf('.p-4'))
    expect(rules.indexOf('.p-4')).toBeLessThan(rules.indexOf('.stock-out-print-page'))
  })

  it('retains palette, small shadows, radius and accessible outline styles', () => {
    expect(declarations('.bg-blue-600').get('background-color')).toBe('#2563eb')
    expect(declarations('.shadow-sm').get('--tw-shadow')).toContain('0 1px 2px 0')
    expect(declarations('.rounded').get('border-radius')).toBe('0.25rem')
    expect(declarations('.outline-none').get('outline')).toBe('2px solid transparent')
    expect(declarations('.focus\\:ring-opacity-75:focus').get('--tw-ring-opacity')).toBe(
      'calc(75 / 100)'
    )
  })

  it('retains sibling spacing selectors and registered animation output', () => {
    expect(declarations('.space-y-4 > :not([hidden]) ~ :not([hidden])').has('margin-top')).toBe(
      true
    )
    expect(
      declarations('.sm\\:space-x-2 > :not([hidden]) ~ :not([hidden])').has('margin-left')
    ).toBe(true)
    const keyframes: string[] = []
    compiled.walkAtRules('keyframes', (rule) => {
      keyframes.push(rule.params)
    })
    expect(keyframes).toEqual(expect.arrayContaining(['enter', 'exit', 'accordion-down']))
  })

  it('retains legible placeholders and white form field backgrounds', () => {
    expect(declarations(/input::placeholder/).get('color')).toBe('#9ca3af')
    expect(declarations(/^input(?:,|$)/).get('background-color')).toBe('#fff')
  })

  it('preserves transparent accessible outlines for focus variants', () => {
    expect(declarations('.outline-none').get('outline-style')).not.toBe('none')
    expect(
      declarations('.focus-visible\\:outline-none:focus-visible').get('outline-style')
    ).not.toBe('none')
    expect(declarations('.focus-visible\\:outline-none:focus-visible').get('outline')).toBe(
      '2px solid transparent'
    )
  })

  it('preserves hover variants on touch devices without a hover-capability media gate', () => {
    let found = false
    const gates: string[] = []
    compiled.walkRules('.hover\\:bg-blue-700:hover', (rule) => {
      found = true
      let parent = rule.parent
      while (parent) {
        if (
          parent.type === 'atrule' &&
          parent.name === 'media' &&
          parent.params.includes('hover')
        ) {
          gates.push(parent.params)
        }
        if (parent.type === 'root') break
        parent = parent.parent
      }
    })
    expect(found).toBe(true)
    expect(gates).toEqual([])
  })
})
