/**
 * Pictures of the empty machine at every named view and at three close views, drawn by the
 * render service exactly as an agent's pictures are (no marks).
 *
 *   npx tsx packages/render/scripts/look.ts <directory> [prefix]
 *
 * Writes `<prefix><view>.png` for the machine as it stands by default and
 * `<prefix><view>-shelves-down.png` for the views of the upper basket with its folding shelves
 * let down, and prints the fingerprint of the drawing code (part of the key pictures are cached
 * under) and how long a picture took.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MachineConfig } from '@spotless/machine';
import { buildMachineGeometry, findMachine } from '@spotless/machine';
import { HeadlessRenderer } from '../src/headless/index.ts';
import type { CameraSpec, MachinePartInput, ViewSubject } from '../src/types.ts';
import { SCENE_VIEW_NAMES } from '../src/types.ts';
import { fitView, viewSpec } from '../src/views.ts';

const [, , outDir = 'look', prefix = ''] = process.argv;
const SIZE = 1024;
const mm = (v: readonly number[]): [number, number, number] => [
  (v[0] as number) * 1000,
  (v[1] as number) * 1000,
  (v[2] as number) * 1000,
];

const spec = findMachine('bosch_smv4hax40g');
if (spec === undefined) throw new Error('the Bosch is not in the machine package');

function sceneOf(config: MachineConfig): { parts: MachinePartInput[]; subject: ViewSubject } {
  const geometry = buildMachineGeometry(spec as NonNullable<typeof spec>, config);
  const parts = geometry.parts.map((part) => ({
    id: part.id,
    role: part.role,
    material: part.material,
    reference_pose: part.pose,
    shape: part.shape,
  }));
  const racks: ViewSubject['racks'][number][] = geometry.affordances.baskets.map((basket) => {
    const size = (spec as NonNullable<typeof spec>).baskets.find((b) => b.id === basket.basketId)
      ?.outline.size ?? [0.5, 0.5];
    const clear = Math.min(
      ...basket.overhead.filter((o) => o.region.kind === 'everywhere').map((o) => o.clearHeight),
    );
    return {
      rack: basket.frame,
      origin_mm: mm(basket.originTub),
      envelope_mm: mm([size[0] as number, size[1] as number, clear]),
    };
  });
  const cutlery = geometry.affordances.cutleryBasket;
  const cutlerySpec = (spec as NonNullable<typeof spec>).cutleryBasket;
  if (cutlery !== null && cutlerySpec !== null) {
    racks.push({
      rack: 'cutlery_basket',
      origin_mm: mm(cutlery.poseTub.p),
      envelope_mm: mm([cutlerySpec.size[1], cutlerySpec.size[0], cutlerySpec.size[2]]),
    });
  }
  const tub = (spec as NonNullable<typeof spec>).tub;
  return {
    parts,
    subject: {
      tub_min_mm: mm([tub.x[0], tub.y[0], tub.z[0]]),
      tub_max_mm: mm([tub.x[1], tub.y[1], tub.z[1]]),
      racks,
    },
  };
}

function closeUp(
  target: [number, number, number],
  azimuthDeg: number,
  elevationDeg: number,
  distance: number,
): CameraSpec {
  const a = (azimuthDeg * Math.PI) / 180;
  const e = (elevationDeg * Math.PI) / 180;
  return {
    kind: 'perspective',
    target_mm: target,
    position_mm: [
      target[0] + Math.sin(a) * Math.cos(e) * distance,
      target[1] - Math.cos(a) * Math.cos(e) * distance,
      target[2] + Math.sin(e) * distance,
    ],
    up: [0, 0, 1],
    fov_deg: 32,
    half_height_mm: 200,
    clip_above_mm: null,
    clip_below_mm: null,
  };
}

const renderer = await HeadlessRenderer.launch();
console.log(`drawing code ${renderer.bundle.fingerprint.slice(0, 16)}, gpu ${renderer.gpu}`);
mkdirSync(outDir, { recursive: true });

async function draw(scene: string, name: string, camera: CameraSpec): Promise<number> {
  const started = performance.now();
  const png = await renderer.render({
    scene,
    wash: null,
    width: SIZE,
    height: SIZE,
    camera,
    poses: { parts: {}, items: {} },
    highlight: [],
    ghost: null,
    marks: { lines: [], dots: [], texts: [] },
  });
  writeFileSync(join(outDir, `${prefix}${name}.png`), png);
  return performance.now() - started;
}

const config = (spec as NonNullable<typeof spec>).defaultConfig;
const standing = sceneOf(config);
await renderer.loadScene('default', { parts: standing.parts, item_types: [], items: [] });
const times: number[] = [];
for (const view of SCENE_VIEW_NAMES) {
  times.push(await draw('default', view, fitView(viewSpec(view, standing.subject), 1)));
}
const cutleryRack = standing.subject.racks.find((r) => r.rack === 'cutlery_basket');
if (cutleryRack !== undefined) {
  const c: [number, number, number] = [
    cutleryRack.origin_mm[0] + cutleryRack.envelope_mm[0] / 2,
    cutleryRack.origin_mm[1] + cutleryRack.envelope_mm[1] / 2,
    cutleryRack.origin_mm[2] + 70,
  ];
  times.push(await draw('default', 'close_cutlery', closeUp(c, 35, 40, 520)));
  times.push(await draw('default', 'close_cutlery_low', closeUp(c, -50, 12, 520)));
}
times.push(await draw('default', 'close_filter', closeUp([-70, -70, 0], -150, 50, 560)));

// The folding shelves of the upper basket let down.
const down = sceneOf({
  ...config,
  shelves: config.shelves.map((shelf) => ({ ...shelf, state: 'down' as const })),
});
const upper = down.subject.racks.find((r) => r.rack === 'upper_rack');
for (const [key, scene] of [
  ['default', standing],
  ['down', down],
] as const) {
  if (key === 'down') {
    await renderer.loadScene('down', { parts: scene.parts, item_types: [], items: [] });
  }
  const tag = key === 'down' ? '-shelves-down' : '';
  if (upper !== undefined) {
    const c: [number, number, number] = [
      upper.origin_mm[0] + upper.envelope_mm[0] / 2,
      upper.origin_mm[1] + upper.envelope_mm[1] / 2,
      upper.origin_mm[2] + 80,
    ];
    times.push(await draw(key, `close_upper${tag}`, closeUp(c, 30, 48, 1150)));
    times.push(await draw(key, `close_upper_below${tag}`, closeUp(c, 25, -35, 1150)));
  }
  if (key === 'down') {
    for (const view of ['iso_upper', 'top_upper'] as const) {
      times.push(await draw(key, `${view}${tag}`, fitView(viewSpec(view, scene.subject), 1)));
    }
  }
}
times.sort((a, b) => a - b);
console.log(
  `${String(times.length)} pictures of ${String(SIZE)} px: median ${(times[times.length >> 1] as number).toFixed(0)} ms, slowest ${(times[times.length - 1] as number).toFixed(0)} ms`,
);
await renderer.close();
