import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { pathToFileURL } from 'node:url'

import { build } from 'esbuild'
import { createMermaidRenderer, type RenderResult } from 'mermaid-isomorphic'
import { type Browser, chromium, firefox } from 'playwright'
import { testFixturesDirectory } from 'snapshot-fixtures'

const require = createRequire(import.meta.url)
const irishGrover = pathToFileURL(require.resolve('@fontsource/irish-grover'))
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
    entryPoints: [require.resolve('./test.bundle')],
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

    async 'firefox.svg'(file) {
      const renderer = createMermaidRenderer({ browser: firefox })
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

test('concurrent rendering', async () => {
  const renderer = createMermaidRenderer({ browser: chromium })

  const results = await Promise.all([
    renderer(['graph TD;\nA-->B']),
    renderer(['invalid']),
    renderer(['graph TD;\nC-->D'])
  ])
  assert.strictEqual(results[0][0].status, 'fulfilled')
  assert.strictEqual(results[1][0].status, 'rejected')
  assert.strictEqual(results[2][0].status, 'fulfilled')
})
