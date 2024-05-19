import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { pathToFileURL } from 'node:url'

import { build } from 'esbuild'
import { createMermaidRenderer, type RenderResult } from 'mermaid-isomorphic'
import { type Browser, chromium, firefox } from 'playwright-core'
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
    entryPoints: ['mermaid-isomorphic'],
    format: 'cjs',
    write: false
  })
  assert.deepEqual(output.errors, [])
  assert.deepEqual(output.warnings, [])
  assert.equal(output.outputFiles.length, 1)
  content = `(() => {
    let module = {};

    ${output.outputFiles[0].text}

    Object.assign(window, module.exports)
  })()`

  browser = await chromium.launch({ headless: true })
})

after(async () => {
  await browser?.close()
})

testFixturesDirectory({
  directory: new URL('../fixtures', import.meta.url),
  prettier: true,
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
        css: [irishGrover],
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
        (diagram) =>
          createMermaidRenderer()([
            `%%{
            init: {
              "fontFamily": "arial,sans-serif"
            }
          }%%\n${diagram}`
          ]),
        String(file)
      )

      return testFixtureResults(results)
    }
  }
})

test('handle errors', async () => {
  const renderer = createMermaidRenderer({ browser: chromium })
  const results = await renderer(['invalid'])

  assert.equal(results.length, 1)
  const [result] = results
  assert.strictEqual(result.status, 'rejected')
  assert(result.reason instanceof Error)
  assert.equal(result.reason.name, 'UnknownDiagramError')
  assert.match(result.reason.stack!, /\/node_modules\/mermaid\/dist\/mermaid\.js:\d+:\d+/)
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
