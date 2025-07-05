import mermaid from 'mermaid'

import {
  type MermaidRenderer,
  type createMermaidRenderer as nodeImplementation,
  type RenderResult
} from './mermaid-isomorphic.js'

const parser = new DOMParser()
const serializer = new XMLSerializer()

/**
 * Get an aria value form a referencing attribute.
 *
 * @param element
 *   The SVG element the get the value from.
 * @param attribute
 *   The attribute whose value to get.
 * @returns
 *   The aria value.
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

let count = 0

const renderer: MermaidRenderer = async (diagrams, options) => {
  const container = document.createElement('div')
  container.ariaHidden = 'true'
  container.style.maxHeight = '0'
  container.style.opacity = '0'
  container.style.overflow = 'hidden'
  if (options?.containerStyle) {
    Object.assign(container.style, options.containerStyle)
  }
  document.body.append(container)

  const results = await Promise.allSettled(
    diagrams.map(async (diagram) => {
      const id = `${options?.prefix ?? 'mermaid'}-${count}`
      count += 1

      const { svg } = await mermaid.render(id, diagram, container)
      const root = parser.parseFromString(svg, 'text/html')
      const [element] = root.getElementsByTagName('svg')
      const { height, width } = element.viewBox.baseVal
      const description = getAriaValue(element, 'aria-describedby')
      const title = getAriaValue(element, 'aria-labelledby')

      const result: RenderResult = {
        height,
        id,
        svg: serializer.serializeToString(element),
        width
      }

      if (description) {
        result.description = description
      }

      if (title) {
        result.title = title
      }

      return result
    })
  )

  container.remove()
  return results
}

export const createMermaidRenderer: typeof nodeImplementation = () => renderer
