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

export interface RenderResult {
  /**
   * The aria description of the diagram.
   */
  description?: string

  /**
   * The height of the resulting SVG.
   */
  height: number

  /**
   * The DOM id of the SVG node.
   */
  id: string

  /**
   * The diagram SVG rendered as a PNG buffer.
   */
  screenshot?: Buffer

  /**
   * The diagram rendered as an SVG.
   */
  svg: string

  /**
   * The title of the rendered diagram.
   */
  title?: string

  /**
   * The width of the resulting SVG.
   */
  width: number
}

export interface RenderOptions {
  /**
   * A URL that points to a custom CSS file to load.
   *
   * Use this to load custom fonts.
   *
   * This option is ignored in the browser. You need to include the CSS in your build manually.
   */
  css?: URL | string | undefined

  /**
   * If true, a PNG screenshot of the diagram will be added.
   *
   * This is only supported in the Node.js.
   */
  screenshot?: boolean

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
export type MermaidRenderer = (
  diagrams: string[],
  options?: RenderOptions
) => Promise<PromiseSettledResult<RenderResult>[]>

interface RenderDiagramsOptions
  extends Required<Pick<RenderOptions, 'mermaidConfig' | 'prefix' | 'screenshot'>> {
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
  mermaidConfig,
  prefix,
  screenshot
}: RenderDiagramsOptions): Promise<PromiseSettledResult<RenderResult>[]> {
  await Promise.all(Array.from(document.fonts, (font) => font.load()))
  const parser = new DOMParser()

  mermaid.initialize(mermaidConfig)

  /**
   * Get an aria value form a referencing attribute.
   *
   * @param element The SVG element the get the value from.
   * @param attribute The attribute whose value to get.
   * @returns The aria value.
   */
  // eslint-disable-next-line unicorn/consistent-function-scoping
  function getAriaValue(element: SVGSVGElement, attribute: string): string | undefined {
    const value = element.getAttribute(attribute)
    if (!value) {
      return
    }

    let result = ''
    for (const id of value.split(/\s+/)) {
      const node = element.getElementById(id)
      if (node) {
        result += node.textContent
      }
    }
    return result
  }

  return Promise.allSettled(
    diagrams.map(async (diagram, index) => {
      const id = `${prefix}-${index}`

      try {
        const { svg } = await mermaid.render(id, diagram)
        const root = parser.parseFromString(svg, 'image/svg+xml')
        const element = root.firstChild as SVGSVGElement
        const { height, width } = element.viewBox.baseVal
        const description = getAriaValue(element, 'aria-describedby')
        const title = getAriaValue(element, 'aria-labelledby')

        if (screenshot) {
          document.body.append(element)
        }

        const result: RenderResult = { height, id, svg, width }

        if (description) {
          result.description = description
        }

        if (title) {
          result.title = title
        }

        return result
      } catch (error) {
        throw error instanceof Error
          ? { name: error.name, stack: error.stack, message: error.message }
          : error
      }
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

  return async (diagrams, renderOptions) => {
    count += 1
    if (!browserPromise) {
      browserPromise = browser?.launch(launchOptions)
    }

    const browserInstance = await browserPromise

    let page: Page | undefined
    let renderResults: PromiseSettledResult<RenderResult>[]

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
        screenshot: Boolean(renderOptions?.screenshot),
        mermaidConfig: {
          fontFamily: 'arial,sans-serif',
          ...renderOptions?.mermaidConfig
        },
        prefix: renderOptions?.prefix ?? 'mermaid'
      })
      if (renderOptions?.screenshot) {
        for (const result of renderResults) {
          if (result.status === 'fulfilled') {
            result.value.screenshot = await page
              .locator(`#${result.value.id}`)
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

    return renderResults
  }
}
