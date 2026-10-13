const selectorParser = require('postcss-selector-parser')

module.exports = () => ({
  postcssPlugin: 'replenops-css-compatibility',
  OnceExit(root, { postcss }) {
    root.walkRules((rule) => {
      let siblingUtility = false
      let hiddenOutline = false
      rule.selector = selectorParser((selectors) => {
        selectors.walkClasses((node) => {
          if (/(?:^|:)outline-none$/.test(node.value)) hiddenOutline = true
        })
        selectors.walkPseudos((pseudo) => {
          if (pseudo.value !== ':where' || pseudo.nodes.length !== 1) return
          const branch = pseudo.first
          const childIndex = branch.nodes.findIndex(
            (node) => node.type === 'combinator' && node.value === '>'
          )
          const last = branch.last
          if (
            childIndex < 0 ||
            last.type !== 'pseudo' ||
            last.value !== ':not' ||
            last.first?.first?.value !== ':last-child' ||
            !branch.nodes
              .slice(0, childIndex)
              .some(
                (node) =>
                  node.type === 'class' && /(?:^|:)(space|divide)-[xy](?:-|$)/.test(node.value)
              )
          )
            return

          const sibling = selectorParser().astSync('& > :not([hidden]) ~ :not([hidden])').first
          sibling.first.replaceWith(
            ...branch.nodes.slice(0, childIndex).map((node) => node.clone())
          )
          pseudo.replaceWith(...sibling.nodes)
          siblingUtility = true
        })
      }).processSync(rule.selector)

      if (hiddenOutline) {
        rule.walkDecls(/^outline(?:-|$)/, (declaration) => {
          declaration.remove()
        })
        rule.append([
          postcss.decl({ prop: 'outline', value: '2px solid transparent' }),
          postcss.decl({ prop: 'outline-offset', value: '2px' }),
        ])
      }

      if (siblingUtility) {
        const properties = {
          'margin-block-start': 'margin-bottom',
          'margin-block-end': 'margin-top',
          'margin-inline-start': 'margin-right',
          'margin-inline-end': 'margin-left',
          'border-block-start-width': 'border-bottom-width',
          'border-block-end-width': 'border-top-width',
          'border-inline-start-width': 'border-right-width',
          'border-inline-end-width': 'border-left-width',
        }
        rule.walkDecls((declaration) => {
          declaration.prop = properties[declaration.prop] ?? declaration.prop
        })
      }
      if (rule.selector.startsWith('[hidden]:where')) {
        rule.selector = '[hidden]'
        rule.walkDecls('display', (declaration) => {
          declaration.important = false
        })
      }
    })

    root.walkRules('.container', (rule) => {
      rule.removeAll()
      rule.append([
        postcss.decl({ prop: 'width', value: '100%' }),
        postcss.decl({ prop: 'margin-inline', value: 'auto' }),
        postcss.decl({ prop: 'padding-inline', value: '2rem' }),
        postcss
          .atRule({ name: 'media', params: '(min-width: 1400px)' })
          .append(postcss.decl({ prop: 'max-width', value: '1400px' })),
      ])
    })

    root.walkDecls('--tw-ring-color', (declaration) => {
      if (declaration.value !== 'initial') {
        declaration.value = `color-mix(in srgb, ${declaration.value} calc(var(--tw-ring-opacity, 1) * 100%), transparent)`
      }
    })

    // Preserve the existing Ant Design cascade and put browser fallbacks first.
    const layers = new Map(
      ['properties', 'theme', 'base', 'components', 'utilities'].map((name) => [name, []])
    )
    for (const node of [...root.nodes]) {
      if (
        node.type === 'atrule' &&
        node.name === 'layer' &&
        layers.has(node.params) &&
        node.nodes
      ) {
        layers.get(node.params).push(...node.nodes)
        node.remove()
      }
    }
    root.prepend([...layers.values()].flat())
    root.walkAtRules('layer', (rule) => {
      if (rule.nodes) rule.replaceWith(rule.nodes)
      else rule.remove()
    })
  },
})

module.exports.postcss = true
