import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { after, before, describe, test } from 'node:test'
import { pathToFileURL } from 'node:url'

import { build } from 'esbuild'
import { type Browser, chromium, firefox } from 'playwright-core'
import prettier from 'prettier'

import { createMermaidRenderer } from './index.js'

const require = createRequire(import.meta.url)
const irishGrover = pathToFileURL(require.resolve('@fontsource/irish-grover'))
const fixturesPath = new URL('fixtures/', import.meta.url)
const fixtureNames = (await readdir(fixturesPath)).sort()

interface FixtureTest {
  input: string
  validate: (actual: string) => Promise<void>
}

async function readFixture(name: string, expectedName: string): Promise<FixtureTest> {
  const fixturePath = new URL(`${name}/`, fixturesPath)
  const inputPath = new URL('input.mmd', fixturePath)
  const expectedPath = new URL(expectedName, fixturePath)

  const input = await readFile(inputPath, 'utf8')
  let expected: string | undefined
  try {
    expected = await readFile(expectedPath, 'utf8')
  } catch {
    await writeFile(expectedPath, '')
  }

  return {
    input,
    async validate(actual) {
      const normalized = prettier.format(actual, { parser: 'html' })
      if (process.argv.includes('update') || !expected) {
        await writeFile(expectedPath, normalized)
      }
      assert.equal(normalized, expected)
    }
  }
}

describe('node', () => {
  for (const name of fixtureNames) {
    test(name, async () => {
      const { input, validate } = await readFixture(name, 'expected.svg')
      const renderer = createMermaidRenderer()

      const results = await renderer([input])

      assert.equal(results.length, 1)
      const [result] = results
      assert.equal(result.status, 'fulfilled')

      await validate(result.value)
    })

    test(`${name} with options`, async () => {
      const { input, validate } = await readFixture(name, 'with-options.svg')
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
      const { input, validate } = await readFixture(name, 'custom-font.svg')
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
      const { input, validate } = await readFixture(name, 'firefox.svg')
      const renderer = createMermaidRenderer({ browser: firefox })

      const results = await renderer([input])

      assert.equal(results.length, 1)
      const [result] = results
      assert.equal(result.status, 'fulfilled')

      await validate(result.value)
    })
  }

  test('multiple diagrams', async () => {
    const fixtures = await Promise.all(
      fixtureNames.map((name) => readFixture(name, 'multiple.svg'))
    )
    const renderer = createMermaidRenderer()
    const results = await renderer(fixtures.map((fixture) => fixture.input))

    assert.equal(results.length, fixtures.length)

    for (const [index, result] of results.entries()) {
      assert.equal(result.status, 'fulfilled')

      const { validate } = fixtures[index]

      await validate(result.value)
    }
  })

  test('handle errors', async () => {
    const renderer = createMermaidRenderer({ browser: chromium })
    const results = await renderer(['graph'])

    assert.equal(results.length, 1)
    const [result] = results
    assert.strictEqual(result.status, 'rejected' as const)
    assert(result.reason instanceof Error)
    assert.equal(result.reason.name, 'Error')
    assert.match(result.reason.stack!, /\/node_modules\/mermaid\/dist\/mermaid\.js:\d+:\d+/)
  })
})

describe('browser', () => {
  let browser: Browser
  let content: string

  before(async () => {
    const output = await build({
      bundle: true,
      entryPoints: ['./browser.ts'],
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

    const { input, validate } = await readFixture('simple', 'browser.svg')
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
