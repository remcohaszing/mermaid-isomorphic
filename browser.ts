import mermaid from 'mermaid'

import { type MermaidRenderer, type createMermaidRenderer as nodeImplementation } from './index.js'

const renderer: MermaidRenderer = (diagrams, options) =>
  Promise.allSettled(
    diagrams.map((diagram, index) =>
      mermaid
        .render(`${options?.prefix ?? 'mermaid'}-${index}`, diagram)
        .then((result) => result.svg)
    )
  )

export const createMermaidRenderer: typeof nodeImplementation = () => renderer
