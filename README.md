# mermaid-isomorphis

[![github actions](https://github.com/remcohaszing/mermaid-isomorphic/actions/workflows/ci.yml/badge.svg)](https://github.com/remcohaszing/mermaid-isomorphic/actions/workflows/ci.yaml)
[![npm](https://img.shields.io/npm/v/mermaid-isomorphic)](https://www.npmjs.com/package/mermaid-isomorphic)
[![codecov](https://codecov.io/gh/remcohaszing/mermaid-isomorphic/branch/main/graph/badge.svg)](https://codecov.io/gh/remcohaszing/mermaid-isomorphic)

Render [Mermaid](https://mermaid.js.org) diagrams in the browser or Node.js.

This is useful if you wish to render Mermaid diagrams in a Node.js or an isomorphic environment. If
you want to render Mermaid diagrams in the browser directly, use the
[`mermaid`](https://www.npmjs.com/package/mermaid) package directly.

## Installation

```sh
npm install mermaid-isomorphic
```

This library uses [Playwright](https://playwright.dev/) under the hood in Node.js. You may need to
install the Playwright browser before using this package.

```sh
npx playwright install --with-deps chrome
```

## Usage

First, create a Mermaid renderer. Then use this renderer to render your diagrams.

```js
import { createMermaidRenderer } from 'mermaid-isomorphic'

const renderer = createMermaidRenderer()
const diagram = `
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
`

const results = await renderer([diagram])
console.log(results)
```

## API

### `createMermaidRenderer(options?: CreateMermaidRendererOptions)`

Create a Mermaid renderer.

The Mermaid renderer manages a browser instance. If multiple diagrams are being rendered
simultaneously, the internal browser instance will be re-used. If no diagrams are being rendered,
the browser will be closed.

### Options

- `browser` (`BrowserType`): The Playwright browser to use. (default: chromium)
- `launchOptions`: (`LaunchOptions`): The options used to launch the browser.

### Returns

A function that renders Mermaid diagrams in the browser. This function has the following call
signature:

```ts
type MermaidRenderer = (
  diagrams: string[],
  options?: RenderOptions
) => Promise<PromiseSettledResult<string>[]>
```

- `diagrams` (`string[]`): An array of mermaid diagrams to render.
- `options`:
  - `prefix`: A custom prefix to use for Mermaid IDs (default: `mermaid`).
  - `mermaidOptions`: A custom Mermaid configuration.

### License

[MIT](LICENSE.md) @ [Remco Haszing](https://github.com/remcohaszing)
