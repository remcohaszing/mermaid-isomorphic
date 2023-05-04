import mermaid from 'mermaid'

import {
  type MermaidRenderer,
  type createMermaidRenderer as nodeImplementation,
  type RenderResult
} from './index.js'

const parser = new DOMParser()

/**
 * Get an aria value form a referencing attribute.
 *
 * @param element The SVG element the get the value from.
 * @param attribute The attribute whose value to get.
 * @returns The aria value.
 */
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

const renderer: MermaidRenderer = (diagrams, options) =>
  Promise.allSettled(
    diagrams.map(async (diagram, index) => {
      const id = `${options?.prefix ?? 'mermaid'}-${index}`

      const { svg } = await mermaid.render(id, diagram)
      const root = parser.parseFromString(svg, 'image/svg+xml')
      const element = root.firstChild as SVGSVGElement
      const { height, width } = element.viewBox.baseVal
      const description = getAriaValue(element, 'aria-describedby')
      const title = getAriaValue(element, 'aria-labelledby')

      const result: RenderResult = { height, id, svg, width }

      if (description) {
        result.description = description
      }

      if (title) {
        result.title = title
      }

      return result
    })
  )

export const createMermaidRenderer: typeof nodeImplementation = () => renderer
