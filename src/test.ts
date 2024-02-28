import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { after, before, describe, test } from 'node:test'
import { pathToFileURL } from 'node:url'

import { build } from 'esbuild'
import { createMermaidRenderer, type RenderResult } from 'mermaid-isomorphic'
import { type Browser, chromium, firefox } from 'playwright-core'
import prettier from 'prettier'

const require = createRequire(import.meta.url)
const irishGrover = pathToFileURL(require.resolve('@fontsource/irish-grover'))
const fixturesPath = new URL('../fixtures/', import.meta.url)
const fixtureNames = (await readdir(fixturesPath)).sort()

interface FixtureTest {
  input: string
  validate: (actual: RenderResult) => Promise<void>
}

async function readFixture(name: string, expectedName: string): Promise<FixtureTest> {
  const fixturePath = new URL(`${name}/`, fixturesPath)
  const inputPath = new URL('input.mmd', fixturePath)
  const pngPath = new URL(`${expectedName}.png`, fixturePath)
  const expectedPath = new URL(`${expectedName}.svg`, fixturePath)

  const input = await readFile(inputPath, 'utf8')
  let expected: Buffer | string | undefined
  try {
    expected = await readFile(expectedPath, 'utf8')
  } catch {
    await writeFile(expectedPath, '')
  }

  return {
    input,
    async validate({ screenshot, svg, ...meta }) {
      const normalized = await prettier.format(
        `<!--\n${JSON.stringify(meta, undefined, 2)}\n-->\n${svg}`,
        { parser: 'html' }
      )
      if (process.argv.includes('update') || !expected) {
        await writeFile(expectedPath, normalized)

        if (screenshot) {
          await writeFile(pngPath, screenshot)
        }
      }
      assert.equal(normalized, expected)
    }
  }
}

describe('node', () => {
  for (const name of fixtureNames) {
    test(name, async () => {
      const { input, validate } = await readFixture(name, 'expected')
      const renderer = createMermaidRenderer()

      const results = await renderer([input], { screenshot: true })

      assert.equal(results.length, 1)
      const [result] = results
      assert.equal(result.status, 'fulfilled')

      await validate(result.value)
    })

    test(`${name} with options`, async () => {
      const { input, validate } = await readFixture(name, 'with-options')
      const renderer = createMermaidRenderer()

      const results = await renderer([input], {
        mermaidConfig: { theme: 'dark' },
        prefix: 'prefix'
      })

      assert.equal(results.length, 1)
      const [result] = results
      assert.equal(result.status, 'fulfilled')

      await validate(result.value)
    })

    test(`${name} custom font`, async () => {
      const { input, validate } = await readFixture(name, 'custom-font')
      const renderer = createMermaidRenderer()

      const results = await renderer([input], {
        css: irishGrover,
        mermaidConfig: { fontFamily: '"Irish Grover"' }
      })

      assert.equal(results.length, 1)
      const [result] = results
      assert.equal(result.status, 'fulfilled')

      await validate(result.value)
    })

    test(`${name} firefox`, async () => {
      const { input, validate } = await readFixture(name, 'firefox')
      const renderer = createMermaidRenderer({ browser: firefox })

      const results = await renderer([input])

      assert.equal(results.length, 1)
      const [result] = results
      assert.equal(result.status, 'fulfilled')

      await validate(result.value)
    })
  }

  test('handle errors', async () => {
    const renderer = createMermaidRenderer({ browser: chromium })
    const results = await renderer(['invalid'])

    assert.equal(results.length, 1)
    const [result] = results
    assert.strictEqual(result.status, 'rejected' as const)
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
})

describe('browser', () => {
  let browser: Browser
  let content: string

  before(async () => {
    const output = await build({
      bundle: true,
      entryPoints: [require.resolve('./browser.js')],
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

  test('generate diagram', async () => {
    const page = await browser.newPage()
    await page.addScriptTag({ content })

    const { input, validate } = await readFixture('simple', 'browser')
    const results = await page.evaluate(
      (diagram) =>
        createMermaidRenderer()([
          `%%{
            init: {
              "fontFamily": "arial,sans-serif"
            }
          }%%\n${diagram}`
        ]),
      input
    )

    assert.equal(results.length, 1)
    const [result] = results
    assert.equal(result.status, 'fulfilled')

    await validate(result.value)
  })
})
