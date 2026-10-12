/**
 * The render service: headless Chrome with one warm page that holds the scenes and draws
 * pictures of them (`page-entry.ts`), driven from Node through puppeteer-core. Pictures come
 * back as PNG bytes. The same scene, poses, camera and marks give the same bytes on one
 * machine: the page draws with the GPU and nothing in it depends on time.
 *
 * Calls are answered one at a time, in the order they were made.
 */

import { existsSync } from 'node:fs';
import type { Browser, Page } from 'puppeteer-core';
import { launch } from 'puppeteer-core';
import type { PageBundle } from './bundle.ts';
import { buildPageBundle } from './bundle.ts';
import { CHROME_ENV, chromeFlags, resolveChrome } from './chrome.ts';
import type {
  HeadlessItemJob,
  HeadlessPageApi,
  HeadlessRenderJob,
  HeadlessSceneInput,
  HeadlessWashInput,
} from './protocol.ts';

export { DEFAULT_CHROME_PATH } from './chrome.ts';

/** Thrown when the render service cannot start (no Chrome, no WebGL). */
export class RenderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderUnavailableError';
  }
}

/** Options of {@link HeadlessRenderer.launch}. */
export interface HeadlessRendererOptions {
  /**
   * The Chrome to run; default the program `SPOTLESS_CHROME` names, or the first Chrome or
   * Chromium in the usual places of the system (`chrome.ts`).
   */
  readonly chromePath?: string;
  /** Where built page scripts are kept; default a directory under the system's temp. */
  readonly bundleDir?: string;
  /** Scenes the page holds at once; the least recently used is dropped. Default 3. */
  readonly maxScenes?: number;
}

/** How long the parts of a start took, wall-clock milliseconds. */
export interface StartTimings {
  readonly bundleMs: number;
  readonly bundleBuilt: boolean;
  readonly chromeMs: number;
  readonly pageMs: number;
}

type PageWindow = { spotlessRender: HeadlessPageApi };

/** Headless Chrome with the render page loaded. */
export class HeadlessRenderer {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly sceneKeys: string[] = [];
  private readonly washKeys = new Map<string, string | null>();
  private closed = false;

  private constructor(
    private readonly browser: Browser,
    private readonly page: Page,
    /** The page script in use; its fingerprint identifies the drawing code. */
    readonly bundle: PageBundle,
    /** How long the start took. */
    readonly startTimings: StartTimings,
    /** Which GPU draws the pictures, as WebGL names it. */
    readonly gpu: string,
    private readonly maxScenes: number,
  ) {}

  /**
   * Builds (or finds) the page script, starts Chrome and loads the page. Throws a
   * {@link RenderUnavailableError} when Chrome is not there or the page cannot draw.
   */
  static async launch(options: HeadlessRendererOptions = {}): Promise<HeadlessRenderer> {
    let chromePath: string;
    if (options.chromePath !== undefined) {
      chromePath = options.chromePath;
      if (!existsSync(chromePath)) {
        throw new RenderUnavailableError(`no Chrome at '${chromePath}' (set ${CHROME_ENV})`);
      }
    } else {
      try {
        chromePath = resolveChrome();
      } catch (error) {
        throw new RenderUnavailableError(error instanceof Error ? error.message : String(error));
      }
    }
    const t0 = performance.now();
    const bundle = await buildPageBundle(options.bundleDir);
    const t1 = performance.now();
    let browser: Browser;
    try {
      browser = await launch({
        executablePath: chromePath,
        headless: true,
        args: [
          '--window-size=1100,1100',
          // WebGL on the GPU (Metal on macOS only) and no sound: the flags every headless
          // browser of the project shares.
          ...chromeFlags(),
          '--hide-scrollbars',
        ],
        defaultViewport: { width: 1100, height: 1100, deviceScaleFactor: 1 },
      });
    } catch (error) {
      throw new RenderUnavailableError(
        `Chrome did not start: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const t2 = performance.now();
    try {
      const page = await browser.newPage();
      const failures: string[] = [];
      page.on('pageerror', (error: unknown) => {
        failures.push(error instanceof Error ? error.message : String(error));
      });
      await page.setContent(
        '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>',
      );
      await page.addScriptTag({ path: bundle.path });
      const ready = await page.evaluate(
        () => typeof (window as unknown as Partial<PageWindow>).spotlessRender === 'object',
      );
      if (!ready) {
        throw new RenderUnavailableError(
          `the render page did not start${failures.length > 0 ? `: ${failures.join('; ')}` : ''}`,
        );
      }
      const gpu = await page.evaluate(() => (window as unknown as PageWindow).spotlessRender.gpu());
      const t3 = performance.now();
      return new HeadlessRenderer(
        browser,
        page,
        bundle,
        { bundleMs: t1 - t0, bundleBuilt: bundle.built, chromeMs: t2 - t1, pageMs: t3 - t2 },
        gpu,
        options.maxScenes ?? 3,
      );
    } catch (error) {
      await browser.close().catch(() => undefined);
      if (error instanceof RenderUnavailableError) throw error;
      throw new RenderUnavailableError(
        `the render page did not load: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Runs one call on the page after those made before it. */
  private run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(() => {
      if (this.closed) throw new RenderUnavailableError('the render service is closed');
      return work();
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** True when the page holds a scene of that key. */
  hasScene(key: string): boolean {
    return this.sceneKeys.includes(key);
  }

  private touch(key: string): void {
    const at = this.sceneKeys.indexOf(key);
    if (at >= 0) this.sceneKeys.splice(at, 1);
    this.sceneKeys.push(key);
  }

  /** Builds a scene on the page (dropping the least recently used when there are too many). */
  loadScene(key: string, input: HeadlessSceneInput): Promise<void> {
    return this.run(async () => {
      while (this.sceneKeys.length >= this.maxScenes && !this.sceneKeys.includes(key)) {
        const dropped = this.sceneKeys.shift() as string;
        this.washKeys.delete(dropped);
        await this.page.evaluate(
          (k) => (window as unknown as PageWindow).spotlessRender.dropScene(k),
          dropped,
        );
      }
      await this.page.evaluate(
        (k, i) => (window as unknown as PageWindow).spotlessRender.loadScene(k, i),
        key,
        input as never,
      );
      this.touch(key);
      this.washKeys.set(key, null);
    });
  }

  /** The wash state a scene is in: a key, or null for the items as the level soils them. */
  washOf(scene: string): string | null {
    return this.washKeys.get(scene) ?? null;
  }

  /** Sets (or with a null key clears) what a wash left on the items of a scene. */
  setWash(scene: string, key: string | null, input: HeadlessWashInput | null): Promise<void> {
    return this.run(async () => {
      await this.page.evaluate(
        (s, k, i) => (window as unknown as PageWindow).spotlessRender.setWash(s, k, i),
        scene,
        key,
        input as never,
      );
      this.washKeys.set(scene, key);
    });
  }

  /** Draws a picture of the machine. Resolves with the PNG bytes. */
  render(job: HeadlessRenderJob): Promise<Buffer> {
    return this.run(async () => {
      this.touch(job.scene);
      const base64 = await this.page.evaluate(
        (j) => (window as unknown as PageWindow).spotlessRender.render(j),
        job as never,
      );
      return Buffer.from(base64, 'base64');
    });
  }

  /** Draws a picture of one item. Resolves with the PNG bytes. */
  renderItem(job: HeadlessItemJob): Promise<Buffer> {
    return this.run(async () => {
      this.touch(job.scene);
      const base64 = await this.page.evaluate(
        (j) => (window as unknown as PageWindow).spotlessRender.renderItem(j),
        job as never,
      );
      return Buffer.from(base64, 'base64');
    });
  }

  /** Stops Chrome. Calls still waiting are rejected. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.browser.close().catch(() => undefined);
  }
}
