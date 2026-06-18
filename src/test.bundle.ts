import mermaid from 'mermaid'
import { createMermaidRenderer } from '@siriusmart/mermaid-isomorphic'

mermaid.initialize({
  fontFamily: 'arial,sans-serif'
})

Object.assign(globalThis, { createMermaidRenderer })
