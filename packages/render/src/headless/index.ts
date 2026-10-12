/**
 * @spotless/render/headless. The render service for agents: the scene of this package drawn
 * to PNG in headless Chrome from a warm page (docs/design/platform.md section 7). Node only:
 * it starts Chrome through puppeteer-core and builds the page script with Vite.
 *
 *  - `HeadlessRenderer.launch(options)`: Chrome with the render page; `loadScene`, `setWash`,
 *    `render`, `renderItem`, `close`.
 *  - `buildPageBundle`, `pageFingerprint`: the page script and the fingerprint of its sources.
 *  - `protocol.ts`: what goes between Node and the page.
 *  - `resolveChrome`, `chromeFlags`: which browser is run (`SPOTLESS_CHROME`, or the usual
 *    places of the system) and the flags every headless browser of the project shares.
 */

export type {
  HeadlessItemJob,
  HeadlessPageApi,
  HeadlessRenderJob,
  HeadlessSceneInput,
  HeadlessWashInput,
} from './protocol.ts';
export type { PageBundle } from './bundle.ts';
export { buildPageBundle, defaultBundleDir, pageFingerprint } from './bundle.ts';
export type { ChromeLookup } from './chrome.ts';
export {
  CHROME_ENV,
  chromeCandidates,
  chromeFlags,
  ChromeNotFoundError,
  findChrome,
  resolveChrome,
} from './chrome.ts';
export type { HeadlessRendererOptions, StartTimings } from './service.ts';
export { DEFAULT_CHROME_PATH, HeadlessRenderer, RenderUnavailableError } from './service.ts';
