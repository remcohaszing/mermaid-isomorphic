import type { IconPack, RenderResult } from 'mermaid-isomorphic'
import type { Browser } from 'playwright'

import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'
import { createMermaidRenderer } from 'mermaid-isomorphic'
import { chromium, firefox, webkit } from 'playwright'
import { testFixturesDirectory } from 'snapshot-fixtures'

const irishGrover = import.meta.resolve('@fontsource/irish-grover')
let browser: Browser
let content: string

async function testFixtureResults(
  results: PromiseSettledResult<RenderResult>[],
  pngPath?: string
): Promise<string> {
  assert.equal(results.length, 1)
  const [result] = results
  assert.equal(result.status, 'fulfilled')
  const { screenshot, svg, ...meta } = result.value
  if (pngPath) {
    await writeFile(pngPath, screenshot!)
  }
  return `<!--\n${JSON.stringify(meta, undefined, 2)}\n-->\n${svg}`
}

before(async () => {
  const output = await build({
    bundle: true,
    conditions: ['browser'],
    entryPoints: [fileURLToPath(import.meta.resolve('./test.bundle.js'))],
    format: 'iife',
    write: false
  })
  assert.deepEqual(output.errors, [])
  assert.deepEqual(output.warnings, [])
  assert.equal(output.outputFiles.length, 1)
  content = output.outputFiles[0].text

  browser = await chromium.launch({ headless: true })
})

after(async () => {
  await browser?.close()
})

testFixturesDirectory({
  directory: new URL('../fixtures', import.meta.url),
  prettier: true,
  write: true,
  tests: {
    async 'expected.svg'(file) {
      const renderer = createMermaidRenderer()
      const results = await renderer([String(file)], { screenshot: true })

      return testFixtureResults(results, join(file.dirname!, 'expected.png'))
    },

    async 'with-options.svg'(file) {
      const renderer = createMermaidRenderer()
      const results = await renderer([String(file)], {
        containerStyle: { maxWidth: '512px' },
        mermaidConfig: { theme: 'dark' },
        prefix: 'prefix'
      })

      return testFixtureResults(results)
    },

    async 'custom-font.svg'(file) {
      const renderer = createMermaidRenderer()
      const results = await renderer([String(file)], {
        css: irishGrover,
        mermaidConfig: { fontFamily: '"Irish Grover"' }
      })

      return testFixtureResults(results)
    },

    async 'custom-font-iterable.svg'(file) {
      const renderer = createMermaidRenderer()
      const results = await renderer([String(file)], {
        css: [irishGrover, irishGrover],
        mermaidConfig: { fontFamily: '"Irish Grover"' }
      })

      return testFixtureResults(results)
    },

    async 'custom-icon-pack.svg'(file) {
      const renderer = createMermaidRenderer()
      const ICON_PACK = {
        name: 'custom-icons',
        icons: {
          prefix: 'custom-icons',
          icons: {
            alien: {
              body: '<path fill-rule="evenodd" clip-rule="evenodd" d="M8 16L3.54223 12.3383C1.93278 11.0162 1 9.04287 1 6.96005C1 3.11612 4.15607 0 8 0C11.8439 0 15 3.11612 15 6.96005C15 9.04287 14.0672 11.0162 12.4578 12.3383L8 16ZM3 6H5C6.10457 6 7 6.89543 7 8V9L3 7.5V6ZM11 6C9.89543 6 9 6.89543 9 8V9L13 7.5V6H11Z" fill="#000000"/>',
              width: 80,
              height: 80
            }
          }
        }
      } satisfies IconPack
      const results = await renderer([String(file)], {
        iconPacks: [ICON_PACK]
      })

      return testFixtureResults(results)
    },

    async 'firefox.svg'(file) {
      const renderer = createMermaidRenderer({ browserType: firefox })
      const results = await renderer([String(file)])

      return testFixtureResults(results)
    },

    async 'webkit.svg'(file) {
      const renderer = createMermaidRenderer({ browserType: webkit })
      const results = await renderer([String(file)])

      return testFixtureResults(results)
    },

    async 'browser.svg'(file) {
      const page = await browser.newPage()
      await page.addScriptTag({ content })

      const results = await page.evaluate(
        (diagram) => createMermaidRenderer()([diagram]),
        String(file)
      )

      return testFixtureResults(results)
    }
  }
})

describe('nodejs', () => {
  test('concurrent rendering', async () => {
    const renderer = createMermaidRenderer()

    const results = await Promise.all([
      renderer(['graph TD;\nA-->B']),
      renderer(['invalid']),
      renderer(['graph TD;\nC-->D'])
    ])
    assert.strictEqual(results[0][0].status, 'fulfilled')
    assert.strictEqual(results[1][0].status, 'rejected')
    assert.strictEqual(results[2][0].status, 'fulfilled')
  })
})

describe('browser', () => {
  test('error handling', async () => {
    const page = await browser.newPage()
    await page.addScriptTag({ content })

    const results = await page.evaluate(() => createMermaidRenderer()(['invalid']))

    assert.strictEqual(results[0].status, 'rejected')
    const body = await page.innerHTML('body')
    assert.equal(body, '')
  })
})
