import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

import { type Mermaid, type MermaidConfig } from 'mermaid'
import {
  type Browser,
  type BrowserType,
  chromium,
  type LaunchOptions,
  type Page
} from 'playwright-core'

declare const mermaid: Mermaid

const require = createRequire(import.meta.url)
const html = String(new URL('index.html', import.meta.url))
const mermaidScript = { path: require.resolve('mermaid/dist/mermaid.js') }
const faStyle = {
  // We use url, not path. If we use path, the fonts can’t be resolved.
  url: String(pathToFileURL(require.resolve('@fortawesome/fontawesome-free/css/all.css')))
}

export interface CreateMermaidRendererOptions {
  /**
   * The Playwright browser to use.
   *
   * @default chromium
   */
  browser?: BrowserType

  /**
   * The options used to launch the browser.
   */
  launchOptions?: LaunchOptions
}

type Format = 'png' | 'svg'

type RenderResults<F> = Promise<PromiseSettledResult<F extends 'png' ? Buffer : string>[]>

export interface RenderOptions<F extends Format = 'svg'> {
  /**
   * A URL that points to a custom CSS file to load.
   *
   * Use this to load custom fonts.
   *
   * This option is ignored in the browser. You need to include the CSS in your build manually.
   */
  css?: URL | string | undefined

  /**
   * Whether to return the rendered diagram as an SVG string or a PNG buffer.
   *
   * PNG is only supported in the Node.js.
   *
   * @default 'svg'
   */
  format?: F

  /**
   * The mermaid configuration.
   *
   * By default `fontFamily` is set to `arial,sans-serif`.
   *
   * This option is ignored in the browser. You need to call `mermaid.initialize()` manually.
   */
  mermaidConfig?: MermaidConfig

  /**
   * The prefix of the id.
   *
   * @default 'mermaid'
   */
  prefix?: string | undefined
}

/**
 * Render Mermaid diagrams in the browser.
 *
 * @param diagrams The Mermaid diagrams to render.
 * @param options Additional options to use when rendering the diagrams.
 * @returns A list of settled promises that contains the rendered Mermaid diagram. Each result
 *   matches the same index of the input diagrams.
 */
export type MermaidRenderer = <F extends Format = 'svg'>(
  diagrams: string[],
  options?: RenderOptions<F>
) => Promise<PromiseSettledResult<F extends 'png' ? Buffer : string>[]>

interface RenderDiagramsOptions<F extends Format = 'svg'>
  extends Required<Pick<RenderOptions<F>, 'format' | 'mermaidConfig' | 'prefix'>> {
  /**
   * The diagrams to process.
   */
  diagrams: string[]
}

/* c8 ignore start */
/**
 * Render mermaid diagrams in the browser.
 *
 * @param options The options used to render the diagrams
 * @returns A settled promise that holds the rendering results.
 */
export async function renderDiagrams({
  diagrams,
  format,
  mermaidConfig,
  prefix
}: RenderDiagramsOptions<Format>): Promise<PromiseSettledResult<string>[]> {
  await Promise.all(Array.from(document.fonts, (font) => font.load()))

  mermaid.initialize(mermaidConfig)

  return Promise.allSettled(
    diagrams.map((diagram, index) => {
      const id = `${prefix}-${index}`

      return mermaid.render(id, diagram).then(
        ({ svg }) => {
          if (format === 'png') {
            document.body.innerHTML += svg
            return id
          }
          return svg
        },
        (error) => {
          throw error instanceof Error
            ? { name: error.name, stack: error.stack, message: error.message }
            : error
        }
      )
    })
  )
}

/* c8 ignore stop */

/**
 * Create a Mermaid renderer.
 *
 * The Mermaid renderer manages a browser instance. If multiple diagrams are being rendered
 * simultaneously, the internal browser instance will be re-used. If no diagrams are being rendered,
 * the browser will be closed.
 *
 * @param options The options of the Mermaid renderer.
 * @returns A function that renders Mermaid diagrams in the browser.
 */
export function createMermaidRenderer(options: CreateMermaidRendererOptions = {}): MermaidRenderer {
  const { browser = chromium, launchOptions } = options

  let browserPromise: Promise<Browser> | undefined
  let count = 0

  return async <F extends Format = 'svg'>(
    diagrams: string[],
    renderOptions?: RenderOptions<F>
  ): RenderResults<F> => {
    count += 1
    if (!browserPromise) {
      browserPromise = browser?.launch(launchOptions)
    }

    const browserInstance = await browserPromise

    let page: Page | undefined
    let renderResults: PromiseSettledResult<Buffer | string>[]

    try {
      page = await browserInstance.newPage({ bypassCSP: true })
      await page.goto(html)
      const promises = [page.addStyleTag(faStyle), page.addScriptTag(mermaidScript)]
      if (renderOptions?.css) {
        promises.push(page.addStyleTag({ url: String(renderOptions.css) }))
      }
      await Promise.all(promises)

      renderResults = await page.evaluate(renderDiagrams, {
        diagrams,
        format: renderOptions?.format ?? 'svg',
        mermaidConfig: {
          fontFamily: 'arial,sans-serif',
          ...renderOptions?.mermaidConfig
        },
        prefix: renderOptions?.prefix ?? 'mermaid'
      } as RenderDiagramsOptions<Format>)
      if (renderOptions?.format === 'png') {
        for (const result of renderResults) {
          if (result.status === 'fulfilled') {
            result.value = await page
              .locator(`#${result.value}`)
              .screenshot({ omitBackground: true })
          }
        }
      }
    } finally {
      await page?.close()
      count -= 1
      if (!count) {
        await browserInstance.close()
        browserPromise = undefined
      }
    }

    for (const result of renderResults) {
      if (result.status !== 'rejected') {
        continue
      }

      const { reason } = result

      if (reason && 'name' in reason && 'message' in reason && 'stack' in reason) {
        Object.setPrototypeOf(reason, Error.prototype)
      }
    }

    return renderResults as PromiseSettledResult<F extends 'png' ? Buffer : string>[]
  }
}
