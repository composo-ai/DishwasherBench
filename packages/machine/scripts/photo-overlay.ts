/**
 * Projects a basket of the machine model into a photograph, to check the machine data against
 * it: the wires and plastic parts as the geometry builders make them, seen by a pinhole camera,
 * written as two-dimensional polylines in the pixel frame of the picture.
 *
 *   pnpm --filter @spotless/machine exec tsx scripts/photo-overlay.ts \
 *       --out <file.json> [--camera <camera.json>] [--params <params.json>] \
 *       [--basket upper] [--machine <id>]
 *
 * and then, to draw the result over the photograph and cut crops (Python 3 with PIL and numpy;
 * the repository has no JPEG reader):
 *
 *   python3 packages/machine/scripts/photo_overlay_draw.py <photo.jpg> <file.json> <out.jpg> \
 *       [--crop x0,y0,x1,y1] [--scale s] [--only group,group] [--width px]
 *
 * and, to solve the camera from hand-picked points (see the head of that file):
 *
 *   python3 packages/machine/scripts/photo_fit_camera.py <points.json> <camera-out.json>
 *
 * THE FRAME is the basket frame of the machine data ("dossier frame"), in MILLIMETRES: origin on
 * the axis of the spray arm that hangs under the basket (for a basket without one, the origin of
 * its `local.originInTubMm`), x to the right for someone in front of the machine, y to the rear,
 * z up, zero at the tops of the floor wires where the floor's relief is zero. The geometry
 * builders work in the rack frame (metres, origin at the front left corner of the outline); the
 * tool converts.
 *
 * THE CAMERA (camera.json), a pinhole without distortion:
 *
 *   { "positionMm": [x, y, z],        centre of projection, basket frame
 *     "yawDeg": 0, "pitchDeg": 0, "rollDeg": 0,
 *     "focalPx": 4200, "principalPx": [2856, 2142] }
 *
 * With all three angles zero the camera looks along +y (from the front towards the rear), image
 * x is basket +x and image y (down) is basket -z. Yaw turns the view towards +x, pitch turns it
 * up, roll turns the picture clockwise as seen by the viewer (the scene appears turned
 * counter-clockwise). Order: roll about the optical axis first, then pitch, then yaw. Without
 * `--camera` only the three-dimensional segments are written.
 *
 * THE PARAMETERS (params.json), all optional, change a COPY of the basket specification before
 * it is built; nothing in the machine data is touched:
 *
 *   { "spec":  { ... },    deep-merged into the BasketSpec (its own units: METRES, RACK frame;
 *                          arrays and nulls replace, objects merge; arrays of objects with an
 *                          `id` or a `side` merge element by element on that key)
 *     "arm":   { ... },    deep-merged into the spray-arm specification of the basket
 *     "hide":  ["floor.x.*", "holder.*"],   part-id globs to leave out of the drawing
 *     "extra": [ { "id": "relief.left.0", "group": "extra", "radiusMm": 1.75, "closed": false,
 *                  "pointsMm": [[x, y, z], ...] } ]      polylines of your own, BASKET frame, mm
 *   }
 *
 * `extra` is how a shape the builders cannot express (a floor wire with a free tip, a profile
 * that changes from front to back) is laid over the photograph.
 *
 * THE OUTPUT: { camera, frame, segments: [ { id, group, radiusMm, a, b, pa, pb, da, db } ] } with
 * `a`, `b` the ends in the basket frame (mm), `pa`, `pb` their pixels and `da`, `db` their depth
 * along the optical axis (mm); segments are clipped at 20 mm in front of the camera. Groups:
 * rim, wall, floor.x (left-right wires), floor.y (front-back wires), tines, shelf, holder, tray,
 * handle, wheel, arm, extra. A box is its twelve edges; a spray arm is drawn as the circles its
 * blade tips sweep at the heights of its top face and of its underside, and the outline of its
 * hub (the azimuth of the arm in a photograph is not known).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Vec3 } from '@spotless/core';
import { poseTransformPoint } from '@spotless/core';
import type { Part } from '@spotless/geometry';
import type { BasketSpec, MachineSpec, SprayArmSpec } from '../src/index.ts';
import { buildBasketShapes, findMachine, PRIMARY_MACHINE } from '../src/index.ts';

interface Camera {
  readonly positionMm: readonly [number, number, number];
  readonly yawDeg: number;
  readonly pitchDeg: number;
  readonly rollDeg: number;
  readonly focalPx: number;
  readonly principalPx: readonly [number, number];
}

interface ExtraPolyline {
  readonly id: string;
  readonly group?: string;
  readonly radiusMm?: number;
  readonly closed?: boolean;
  readonly pointsMm: readonly (readonly [number, number, number])[];
}

interface Params {
  readonly spec?: Record<string, unknown>;
  readonly arm?: Record<string, unknown>;
  readonly hide?: readonly string[];
  readonly extra?: readonly ExtraPolyline[];
}

interface Segment {
  id: string;
  group: string;
  radiusMm: number;
  a: Vec3;
  b: Vec3;
  pa?: [number, number];
  pb?: [number, number];
  da?: number;
  db?: number;
}

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
}

function readJson<T>(path: string | undefined): T | undefined {
  return path === undefined ? undefined : (JSON.parse(readFileSync(resolve(path), 'utf8')) as T);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function keyOf(v: unknown): string | undefined {
  if (!isObject(v)) return undefined;
  if (typeof v['id'] === 'string') return `id:${v['id']}`;
  if (typeof v['side'] === 'string') return `side:${v['side']}`;
  return undefined;
}

/** Deep merge as the usage note says: objects merge, keyed arrays merge by key, the rest replaces. */
function merge(base: unknown, patch: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(patch)) {
    const keyed = patch.length > 0 && patch.every((p) => keyOf(p) !== undefined);
    if (!keyed || !base.every((b) => keyOf(b) !== undefined)) return patch;
    const out = [...(base as unknown[])];
    for (const p of patch as unknown[]) {
      const at = out.findIndex((b) => keyOf(b) === keyOf(p));
      if (at < 0) out.push(p);
      else out[at] = merge(out[at], p);
    }
    return out;
  }
  if (isObject(base) && isObject(patch)) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(patch)) out[k] = k in base ? merge(base[k], v) : v;
    return out;
  }
  return patch;
}

function globToRegExp(glob: string): RegExp {
  return new RegExp(
    `^${glob
      .split('*')
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
  );
}

function groupOf(shape: 'wires' | 'fittings' | 'tray', id: string): string {
  if (shape === 'tray') return 'tray';
  if (id.startsWith('floor.x')) return 'floor.x';
  if (id.startsWith('floor.y')) return 'floor.y';
  if (id.startsWith('row.')) return 'tines';
  if (id.startsWith('rim')) return 'rim';
  if (id.startsWith('wall') || id.startsWith('upright')) return 'wall';
  return id.split('.')[0] ?? 'other';
}

// ---- arguments
const machineId = argument('machine');
const found = machineId === undefined ? PRIMARY_MACHINE : findMachine(machineId);
if (found === undefined) throw new Error(`no machine "${String(machineId)}"`);
const machine: MachineSpec = found;
const basketId = argument('basket') ?? 'upper';
const outFile = argument('out');
if (outFile === undefined) throw new Error('usage: photo-overlay.ts --out <file.json> ...');
const camera = readJson<Camera>(argument('camera'));
const params = readJson<Params>(argument('params')) ?? {};

const baseBasket = machine.baskets.find((b) => b.id === basketId);
if (baseBasket === undefined) throw new Error(`machine ${machine.id} has no basket "${basketId}"`);
const basket = merge(baseBasket, params.spec ?? {}) as BasketSpec;
const spec: MachineSpec = {
  ...machine,
  baskets: machine.baskets.map((b) => (b.id === basketId ? basket : b)),
};

const baseArm = machine.sprayLevels.find(
  (l): l is SprayArmSpec =>
    l.kind === 'arm' && l.mount.kind === 'basket' && l.mount.basketId === basketId,
);
const arm = baseArm === undefined ? undefined : (merge(baseArm, params.arm ?? {}) as SprayArmSpec);

// The basket frame of the machine data: origin on the arm axis (or the basket's own origin in
// the tub), which in the rack frame is at -originXY shifted by the arm's axis in the tub.
const origin = basket.pose.originXY;
const axis = arm?.axis ?? [0, 0];
const offset: Vec3 = [axis[0] - origin[0], axis[1] - origin[1], 0];
const toFrame = (p: Vec3): Vec3 => [
  (p[0] - offset[0]) * 1000,
  (p[1] - offset[1]) * 1000,
  (p[2] - offset[2]) * 1000,
];

// ---- the segments
const segments: Segment[] = [];
const hide = (params.hide ?? []).map(globToRegExp);
const hidden = (id: string): boolean => hide.some((re) => re.test(id));

function addPart(shape: 'wires' | 'fittings' | 'tray', part: Part): void {
  const id = shape === 'tray' ? `tray.${part.id}` : part.id;
  if (hidden(id)) return;
  const group = groupOf(shape, part.id);
  const at = (p: Vec3): Vec3 => toFrame(poseTransformPoint(part.pose, p));
  const prim = part.prim;
  if (prim.kind === 'capsule') {
    segments.push({ id, group, radiusMm: prim.radius * 1000, a: at(prim.a), b: at(prim.b) });
  } else if (prim.kind === 'rbox') {
    const h = prim.halfExtents.map((e) => e + prim.radius) as [number, number, number];
    const corner = (i: number): Vec3 =>
      at([i & 1 ? h[0] : -h[0], i & 2 ? h[1] : -h[1], i & 4 ? h[2] : -h[2]]);
    for (let i = 0; i < 8; i++) {
      for (const bit of [1, 2, 4]) {
        if (i & bit) continue;
        segments.push({
          id: `${id}.e${i}${i | bit}`,
          group,
          radiusMm: 0,
          a: corner(i),
          b: corner(i | bit),
        });
      }
    }
  }
  // Other primitives (wheels as hulls or solids of revolution) are not drawn.
}

const shapes = buildBasketShapes(spec, basket, spec.defaultConfig, 'polypropylene');
for (const part of shapes.wires.parts) addPart('wires', part);
for (const part of shapes.fittings?.parts ?? []) addPart('fittings', part);
for (const part of shapes.tabletTray?.parts ?? []) addPart('tray', part);

function circle(id: string, radiusMm: number, zMm: number, group = 'arm'): void {
  if (hidden(id)) return;
  const n = 96;
  for (let i = 0; i < n; i++) {
    const t0 = (2 * Math.PI * i) / n;
    const t1 = (2 * Math.PI * (i + 1)) / n;
    segments.push({
      id: `${id}.${i}`,
      group,
      radiusMm: 0,
      a: [radiusMm * Math.cos(t0), radiusMm * Math.sin(t0), zMm],
      b: [radiusMm * Math.cos(t1), radiusMm * Math.sin(t1), zMm],
    });
  }
}
if (arm !== undefined) {
  const tip = arm.tipRadius * 1000;
  const hub = ((arm.shape.hubDiameter ?? 0.05) / 2) * 1000;
  circle('arm.top', tip, arm.topFaceZ * 1000);
  circle('arm.underside', tip, arm.bladeUndersideZ * 1000);
  circle('arm.hub.bottom', hub, arm.hubUndersideZ * 1000);
  circle('arm.hub.top', hub, (arm.hubUndersideZ + (arm.shape.hubHeight ?? 0)) * 1000);
}

for (const extra of params.extra ?? []) {
  if (hidden(extra.id)) continue;
  const pts = extra.pointsMm;
  const count = extra.closed === true ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    segments.push({
      id: `${extra.id}.${i}`,
      group: extra.group ?? 'extra',
      radiusMm: extra.radiusMm ?? 0,
      a: pts[i] as Vec3,
      b: pts[(i + 1) % pts.length] as Vec3,
    });
  }
}

// ---- the camera
const NEAR_MM = 20;
if (camera !== undefined) {
  const rad = Math.PI / 180;
  const [cy, sy] = [Math.cos(camera.yawDeg * rad), Math.sin(camera.yawDeg * rad)];
  const [cp, sp] = [Math.cos(camera.pitchDeg * rad), Math.sin(camera.pitchDeg * rad)];
  const [cr, sr] = [Math.cos(camera.rollDeg * rad), Math.sin(camera.rollDeg * rad)];
  // Camera axes in the basket frame before roll: forward, right, down.
  const fwd: Vec3 = [sy * cp, cy * cp, sp];
  const right0: Vec3 = [cy, -sy, 0];
  const down0: Vec3 = [sy * sp, cy * sp, -cp];
  const right: Vec3 = [
    cr * right0[0] + sr * down0[0],
    cr * right0[1] + sr * down0[1],
    cr * right0[2] + sr * down0[2],
  ];
  const down: Vec3 = [
    cr * down0[0] - sr * right0[0],
    cr * down0[1] - sr * right0[1],
    cr * down0[2] - sr * right0[2],
  ];
  const dot = (u: Vec3, v: Vec3): number => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const view = (p: Vec3): Vec3 => {
    const d: Vec3 = [
      p[0] - camera.positionMm[0],
      p[1] - camera.positionMm[1],
      p[2] - camera.positionMm[2],
    ];
    return [dot(d, right), dot(d, down), dot(d, fwd)];
  };
  const pixel = (v: Vec3): [number, number] => [
    camera.principalPx[0] + (camera.focalPx * v[0]) / v[2],
    camera.principalPx[1] + (camera.focalPx * v[1]) / v[2],
  ];
  const kept: Segment[] = [];
  for (const s of segments) {
    let va = view(s.a);
    let vb = view(s.b);
    if (va[2] < NEAR_MM && vb[2] < NEAR_MM) continue;
    if (va[2] < NEAR_MM || vb[2] < NEAR_MM) {
      const t = (NEAR_MM - va[2]) / (vb[2] - va[2]);
      const cut: Vec3 = [va[0] + t * (vb[0] - va[0]), va[1] + t * (vb[1] - va[1]), NEAR_MM];
      if (va[2] < NEAR_MM) va = cut;
      else vb = cut;
    }
    kept.push({ ...s, pa: pixel(va), pb: pixel(vb), da: va[2], db: vb[2] });
  }
  segments.length = 0;
  segments.push(...kept);
}

const round = (_: string, v: unknown): unknown =>
  typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
writeFileSync(
  resolve(outFile),
  JSON.stringify(
    {
      machine: machine.id,
      basket: basketId,
      frame: 'basket frame of the machine data, mm: origin on the arm axis, x right, y rear, z up',
      rackFrameOffsetMm: offset.map((v) => v * 1000),
      camera: camera ?? null,
      segments,
    },
    round,
  ),
);
console.log(`${outFile}: ${segments.length} segments`);
