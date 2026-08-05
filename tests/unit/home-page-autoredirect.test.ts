import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AutoRedirect } from '@/app/page'

describe('home page auto redirect', () => {
  it('uses the canonical platform URL instead of a relative platform path', () => {
    const markup = renderToStaticMarkup(
      createElement(AutoRedirect, {
        targetUrl: 'https://mobile.test.example.com/mobile',
      })
    )

    expect(markup).toContain('window.location.href = "https://mobile.test.example.com/mobile"')
    expect(markup).not.toContain("window.location.href = '/mobile'")
  })
})
