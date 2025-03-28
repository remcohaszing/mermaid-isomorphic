# mermaid-isomorphic

[![github actions](https://github.com/remcohaszing/mermaid-isomorphic/actions/workflows/ci.yaml/badge.svg)](https://github.com/remcohaszing/mermaid-isomorphic/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/remcohaszing/mermaid-isomorphic/branch/main/graph/badge.svg)](https://codecov.io/gh/remcohaszing/mermaid-isomorphic)
[![npm version](https://img.shields.io/npm/v/mermaid-isomorphic)](https://www.npmjs.com/package/mermaid-isomorphic)
[![npm downloads](https://img.shields.io/npm/dm/mermaid-isomorphic)](https://www.npmjs.com/package/mermaid-isomorphic)

Render [Mermaid](https://mermaid.js.org) diagrams in the browser or Node.js.

This is useful if you wish to render Mermaid diagrams in a Node.js or an isomorphic environment. If
you want to render Mermaid diagrams in the browser directly, use the
[`mermaid`](https://www.npmjs.com/package/mermaid) package directly.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
  - [Fonts](#fonts)
  - [Browser](#browser)
- [API](#api)
  - [`createMermaidRenderer(options?: CreateMermaidRendererOptions)`](#createmermaidrendereroptions-createmermaidrendereroptions)
- [Compatibility](#compatibility)
- [Contributing](#contributing)
- [License](#license)

## Installation

```sh
npm install mermaid-isomorphic
```

Outside of browsers `mermaid-isomorphic` uses [Playwright](https://playwright.dev). If you use this
outside of a browser, you need to install Playwright and a Playwright browser.

```sh
npm install playwright
npx playwright install --with-deps chromium
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

### Fonts

#### FontAwesome

Mermaid has support for
[FontAwesome](https://mermaid.js.org/syntax/flowchart.html#basic-support-for-fontawesome). This is
also supported by `isomorphic-mermaid`, but you need to load the FontAwesome CSS yourself when
serving the SVG.

#### Custom Fonts

By default `mermaid-isomorphic` uses the `arial,sans-serif` font family. This font family is mostly
compatible across all browsers and devices. If you wish to use a custom font, you need to specify
both the `mermaidConfig.fontFamily` and `css` options.

### Browser

`mermaid-isomorphic` is intended for use in Node.js, but also provides a browser export. This means
it can be used in the browser, but it’s recommended to use the
[mermaid](https://mermaid-js.github.io) package directly.

## API

### `createMermaidRenderer(options?: CreateMermaidRendererOptions)`

Create a Mermaid renderer.

The Mermaid renderer manages a browser instance. If multiple diagrams are being rendered
simultaneously, the internal browser instance will be re-used. If no diagrams are being rendered,
the browser will be closed.

#### Options

- `browserType` (`BrowserType`): The Playwright browser to use. (default: chromium)
- `launchOptions`: (`LaunchOptions`): The options used to launch the browser.

#### Returns

A function that renders Mermaid diagrams in the browser. This function has arguments:

- `diagrams` (`string[]`): An array of mermaid diagrams to render.
- `options`:
  - `containerStyle` (`Partial<CSSStyleDeclaration>`): A style to apply to the container used to
    render the diagram. Certain styling is known to override the rendering behaviour. For example,
    the `maxWidth` property affects gantt diagrams. (default:
    `{ maxHeight: '0', opacity: '0', overflow: 'hidden' }`)
  - `css` (`string` | `URL`) A URL that points to a custom CSS file to load. Use this to load custom
    fonts. This option is ignored in the browser. You need to include the CSS in your build
    manually.
  - `screenshot` (`boolean`): If true, a PNG screenshot of the diagram is included as a buffer. This
    is only supported in Node.js.
  - `prefix` (`string`): A custom prefix to use for Mermaid IDs (default: `mermaid`).
  - `mermaidOptions` (`MermaidConfig`): A custom Mermaid configuration. By default `fontFamily` is
    set to `arial,sans-serif`. This option is ignored in the browser. You need to call
    `mermaid.initialize()` manually.

It returns a promise settled result with the render results. The render results have the following
properties:

- `description` (`string`): The aria description of the diagram, if it has one.
- `height` (`number`): The height of the resulting SVG.
- `id` (`string`): The DOM id of the SVG node.
- `screenshot` (`Buffer`): The diagram SVG rendered as a PNG buffer. This is only added if the
  `screenshot` option is true.
- `svg` (`string`): The diagram rendered as an SVG.
- `title` (`string`): The title of the rendered diagram, if it has one.
- `width` (`number`): The width of the resulting SVG.

## Compatibility

This project is compatible with Node.js 18 or greater.

## Contributing

Test fixtures are generated and verified using Linux. Rendering on other platforms may yield
slightly different results. Don’t worry about adding new fixtures, but don’t update existing ones
that cause CI to fail. Furthermore see my global
[contributing guidelines](https://github.com/remcohaszing/.github/blob/main/CONTRIBUTING.md).

## License

[MIT](LICENSE.md) © [Remco Haszing](https://github.com/remcohaszing)
