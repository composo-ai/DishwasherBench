/**
 * Plays the start of a recorded episode through the page in headless Chrome, as a participant
 * of the human baseline meets it: a server in benchmark mode, an episode link, the name asked
 * once, the manual and the loading guidance, the labelled and gridded views, the four
 * pictures of the item in hand; then a short load, the wash (the placeholder: this script is
 * about the recording) and the episode record the server wrote. Screenshots and captions go
 * to `screenshots/benchmark/`.
 *
 *   pnpm --filter @spotless/web benchmark-shots [--out <dir>]
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EpisodeRecord } from '@spotless/server';
import { buildServer, createEpisodeLink } from '@spotless/server';
import { placeholderWashRunner } from '@spotless/session';
import type { DebugState } from './driver.ts';
import { caughtUp, createRun, debug, launchChrome, pickUp, typePose, view } from './driver.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const dist = join(here, '..', 'dist');
const outFlag = process.argv.indexOf('--out');
const outDir =
  outFlag >= 0 && process.argv[outFlag + 1] !== undefined
    ? (process.argv[outFlag + 1] as string)
    : join(here, '..', 'screenshots', 'benchmark');
const ADMIN = 'benchmark-shots-admin-token';

const run = createRun(outDir);
const { problems, captions, expect, screenshot, drop } = run;

async function main(): Promise<number> {
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('the client is not built: run "pnpm --filter @spotless/web build" first');
    return 2;
  }
  mkdirSync(outDir, { recursive: true });
  const dataDir = mkdtempSync(join(tmpdir(), 'spotless-benchmark-shots-'));
  const server = await buildServer({
    dataDir,
    staticDir: dist,
    adminToken: ADMIN,
    washRunner: placeholderWashRunner,
  });
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${(server.app.server.address() as AddressInfo).port}`;
  const browser = await launchChrome();
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  try {
    // Without a link a participant cannot start anything.
    await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.modal');
    expect(
      (await page.$('.level')) === null,
      'in benchmark mode the page offers no list of levels',
    );
    await screenshot(
      page,
      'no-link',
      'benchmark mode without a link: the page asks for the link, offers no levels',
    );

    // An episode created for nobody in particular: the page asks for the name once.
    const created = (await (
      await fetch(`${base}/api/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-spotless-admin': ADMIN },
        body: JSON.stringify({ level_id: 'tutorial' }),
      })
    ).json()) as { session_id: string };
    await page.goto(`${base}/#${created.session_id}`, { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#player-name');
    await screenshot(
      page,
      'name-asked',
      'an episode link without a name: the page says what is recorded and asks who is playing',
    );
    await page.click('#player-name-ok');
    expect(
      (await page.$eval('#player-name-problem', (el) => el.textContent ?? '')).length > 0,
      'an empty name is not taken',
    );
    await page.type('#player-name', 'P07');
    await page.click('#player-name-ok');
    await page.waitForSelector('#player');
    expect(
      (await page.$eval('#player', (el) => el.textContent)) === 'Playing as P07',
      'the name is shown at the top',
    );
    await caughtUp(page);

    // The manual and the guidance, word for word what an agent is given.
    await page.click('#how-to');
    await page.waitForSelector('#loading-guidance');
    const guidance = await page.$eval('#loading-guidance', (el) => el.textContent ?? '');
    const manual = await page.$eval('#level-manual', (el) => el.textContent ?? '');
    const served = (await (await fetch(`${base}/api/guidance`)).json()) as { text: string };
    expect(
      served.text.split('\n\n').every((paragraph) => guidance.includes(paragraph)),
      'the how-to panel shows the loading guidance word for word',
    );
    expect(
      manual.includes('Frames. All frames are right-handed'),
      'the how-to panel shows the manual of the interface',
    );
    await page.$eval('#loading-guidance', (el) => el.scrollIntoView());
    await screenshot(
      page,
      'guidance',
      'the how-to panel: the manual of the interface and the loading guidance every player is shown',
    );
    await page.click('#close-how-to');

    // The item in hand from its four sides, as get_item shows it to an agent.
    await page.waitForFunction(
      () =>
        (window as unknown as { spotless: { debugState(): DebugState } }).spotless.debugState()
          .thumbnails === 12,
      { timeout: 60_000 },
    );
    await pickUp(page, 'plate_01');
    await page.waitForSelector('#item-pictures img');
    expect(
      (await page.$$('#item-pictures img')).length === 4,
      'the item in hand is shown from its four fixed sides',
    );
    await typePose(page, {
      frame: 'lower_rack',
      preset: 'on_edge',
      x: 106,
      y: 368,
      z: 227,
      yaw: 90,
    });
    await screenshot(
      page,
      'item-pictures',
      'a plate in hand: the four pictures of it in the panel on the right',
    );
    await drop(page);
    await pickUp(page, 'bowl_01');
    await typePose(page, { frame: 'lower_rack', preset: 'inclined', x: 420, y: 130, z: 220 });
    await drop(page);

    // The labelled and gridded views.
    await page.click('#show-labels');
    await page.click('#show-grid');
    for (const [name, caption] of [
      [
        'top_lower',
        'the lower basket from above with item ids and the millimetre grid of its frame',
      ],
      ['iso_lower', 'the three-quarter view with the same grid on the base of the basket'],
      [
        'front',
        'the front elevation: tub-frame grid, and a ruler for each basket in its own frame',
      ],
    ] as const) {
      await view(page, name);
      await caughtUp(page);
      await screenshot(page, `marks-${name}`, caption);
    }
    expect(
      (await page.$eval('#show-grid', (el) => (el as HTMLInputElement).checked)) === true,
      'the grid stays on across views',
    );
    await page.click('#show-labels');
    await page.click('#show-grid');
    await view(page, 'iso_lower');

    // Wash, and read what the server recorded.
    await page.$eval('#start-cycle', (el) => el.scrollIntoView());
    await page.click('#start-cycle');
    await page.waitForSelector('#confirm-start');
    await page.click('#confirm-start');
    await page.waitForFunction(
      () =>
        (window as unknown as { spotless: { debugState(): DebugState } }).spotless.debugState()
          .hasReport,
      { timeout: 60_000 },
    );
    await caughtUp(page);
    await screenshot(
      page,
      'report',
      'after the wash (the placeholder here: nothing was simulated)',
    );
    const file = join(dataDir, 'episodes', `${created.session_id}.json`);
    expect(existsSync(file), 'the server wrote the episode record when the wash ended');
    if (existsSync(file)) {
      const record = JSON.parse(readFileSync(file, 'utf8')) as EpisodeRecord;
      expect(
        record.player?.name === 'P07' && record.player.kind === 'human',
        'the record names the player as a person',
      );
      expect(
        record.events.filter((event) => event.name === 'place' && event.accepted).length === 2,
        'the record holds the two placements',
      );
      expect(
        record.score !== null && record.score.items_loaded === 2,
        'the record holds the outcome of the wash',
      );
      expect(
        record.time.loading_s !== null && record.time.loading_s > 0,
        'the record holds the loading time',
      );
      expect(
        !/mouse|pointer/.test(JSON.stringify(record)),
        'the record holds no trace of the mouse',
      );
    }

    // A link that names the player needs no question.
    const named = await createEpisodeLink({
      server: base,
      adminToken: ADMIN,
      levelId: 'tutorial',
      player: 'P08',
    });
    await page.goto(named.url, { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#player');
    expect((await page.$('#player-name')) === null, 'a named episode asks no name');
    expect(
      (await page.$eval('#player', (el) => el.textContent)) === 'Playing as P08',
      'the name of the link command is shown',
    );
    const state = await debug(page);
    expect(state.phase === 'loading', 'the named episode is ready to play');
    expect(consoleErrors.length === 0, `no errors on the page (${consoleErrors.join('; ')})`);
  } finally {
    await browser.close();
    await server.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
  writeFileSync(join(outDir, 'captions.txt'), `${captions.join('\n')}\n`);
  for (const problem of problems) console.error(`PROBLEM: ${problem}`);
  console.log(problems.length === 0 ? 'OK' : `${problems.length} problem(s)`);
  return problems.length === 0 ? 0 : 1;
}

main().then(
  (status) => process.exit(status),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
