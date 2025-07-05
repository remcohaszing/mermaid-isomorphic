import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createMermaidRenderer } from 'mermaid-isomorphic'
import { chromium, firefox, webkit } from 'playwright'

test('chromium', async () => {
  const renderer = createMermaidRenderer({ browserType: chromium })
  const result = await renderer(['graph TD;\nA-->B'])
  assert.equal(result[0].status, 'fulfilled')
})

test('firefox', async () => {
  const renderer = createMermaidRenderer({ browserType: firefox })
  const result = await renderer(['graph TD;\nA-->B'])
  assert.equal(result[0].status, 'fulfilled')
})

test('webkit', async () => {
  const renderer = createMermaidRenderer({ browserType: webkit })
  const result = await renderer(['graph TD;\nA-->B'])
  assert.equal(result[0].status, 'fulfilled')
})
