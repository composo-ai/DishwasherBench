/**
 * Orthographic pictures of a loaded machine, for looking at a load (brief section 3).
 *
 * The pictures are drawn from the geometry kernel's own render meshes (`buildRenderMesh` of the
 * item and machine shapes at the settled poses) by a small depth-buffer rasteriser, so what is
 * shown is exactly the geometry the loading physics and the wash simulation use: nothing is
 * modelled a second time, and no browser is involved. Each surface is shaded by its normal and
 * outlined where the depth or the body changes, which is enough to see whether a plate stands
 * between its tines, a glass floats or something passes through a wire.
 *
 * Units: SI and the tub frame. Colours are 0 to 255.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { quatRotate } from '@spotless/core';
import type { RenderMesh, Shape } from '@spotless/geometry';
import { buildRenderMesh } from '@spotless/geometry';

/** A colour, red, green and blue from 0 to 255. */
export type Rgb = readonly [number, number, number];

/** One rigid body of a picture. */
export interface RenderBody {
  readonly id: string;
  readonly shape: Shape;
  /** Body frame to tub frame. */
  readonly pose: Pose;
  readonly colour: Rgb;
  /**
   * Chord error of its mesh, metres. Default {@link RENDER_CHORD_ERROR}; wires can take a
   * coarser one.
   */
  readonly chordError?: number;
}

/** Chord error of the meshes drawn, metres (coarser than the platform's 0.1 mm for speed). */
export const RENDER_CHORD_ERROR = 0.0004;

/** An orthographic camera: what is right and up in the picture, as tub-frame directions. */
export interface OrthoView {
  readonly name: string;
  /** Unit vector of the tub frame that points to the right of the picture. */
  readonly right: Vec3;
  /** Unit vector of the tub frame that points up in the picture. */
  readonly up: Vec3;
  /** The box of the tub frame the picture frames, metres. */
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
  /** Text drawn nowhere: kept with the picture's metadata. */
  readonly caption: string;
}

/** A finished picture: 8-bit RGBA rows from the top. */
export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

/** Options of {@link renderView}. */
export interface RenderViewOptions {
  /** Width of the picture in pixels; the height follows from the framed box. */
  readonly widthPx: number;
  /** Supersampling factor per axis (default 2). */
  readonly supersample?: number;
  /** Background colour (default near white). */
  readonly background?: Rgb;
}

const meshCache = new WeakMap<Shape, Map<number, RenderMesh>>();

function meshOf(shape: Shape, chordError: number): RenderMesh {
  let byError = meshCache.get(shape);
  if (byError === undefined) {
    byError = new Map();
    meshCache.set(shape, byError);
  }
  let mesh = byError.get(chordError);
  if (mesh === undefined) {
    mesh = buildRenderMesh(shape, { chordError });
    byError.set(chordError, mesh);
  }
  return mesh;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalised(a: Vec3): Vec3 {
  const length = Math.hypot(a[0], a[1], a[2]);
  return length === 0 ? [0, 0, 1] : [a[0] / length, a[1] / length, a[2] / length];
}

/**
 * Draws the bodies as seen by an orthographic camera. Nearer surfaces hide farther ones; a
 * surface is lit from the upper left of the viewer, and darkened along its silhouette.
 */
export function renderView(
  bodies: readonly RenderBody[],
  view: OrthoView,
  options: RenderViewOptions,
): Raster {
  const ss = Math.max(1, Math.round(options.supersample ?? 2));
  const background = options.background ?? [250, 250, 248];
  const right = normalised(view.right);
  const up = normalised(view.up);
  // Towards the viewer.
  const toViewer = normalised(cross(right, up));

  // The framed box in view coordinates.
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const x of [view.bounds.min[0], view.bounds.max[0]]) {
    for (const y of [view.bounds.min[1], view.bounds.max[1]]) {
      for (const z of [view.bounds.min[2], view.bounds.max[2]]) {
        const u = dot([x, y, z], right);
        const v = dot([x, y, z], up);
        uMin = Math.min(uMin, u);
        uMax = Math.max(uMax, u);
        vMin = Math.min(vMin, v);
        vMax = Math.max(vMax, v);
      }
    }
  }
  const width = Math.max(8, Math.round(options.widthPx));
  const scale = width / (uMax - uMin);
  const height = Math.max(8, Math.round((vMax - vMin) * scale));
  const W = width * ss;
  const H = height * ss;
  const pxPerM = scale * ss;

  const depth = new Float32Array(W * H).fill(-Infinity);
  const owner = new Int32Array(W * H).fill(-1);
  const shade = new Float32Array(W * H);

  // Light from the upper left, a little towards the viewer.
  const light = normalised([
    -0.45 * right[0] + 0.55 * up[0] + 0.7 * toViewer[0],
    -0.45 * right[1] + 0.55 * up[1] + 0.7 * toViewer[1],
    -0.45 * right[2] + 0.55 * up[2] + 0.7 * toViewer[2],
  ]);

  bodies.forEach((body, bodyIndex) => {
    const mesh = meshOf(body.shape, body.chordError ?? RENDER_CHORD_ERROR);
    const count = mesh.positions.length / 3;
    const sx = new Float32Array(count);
    const sy = new Float32Array(count);
    const sz = new Float32Array(count);
    const sl = new Float32Array(count);
    const { p, q } = body.pose;
    for (let i = 0; i < count; i++) {
      const local: Vec3 = [
        mesh.positions[3 * i] as number,
        mesh.positions[3 * i + 1] as number,
        mesh.positions[3 * i + 2] as number,
      ];
      const r = quatRotate(q, local);
      const world: Vec3 = [r[0] + p[0], r[1] + p[1], r[2] + p[2]];
      sx[i] = (dot(world, right) - uMin) * pxPerM;
      sy[i] = (vMax - dot(world, up)) * pxPerM;
      sz[i] = dot(world, toViewer);
      const n = quatRotate(q, [
        mesh.normals[3 * i] as number,
        mesh.normals[3 * i + 1] as number,
        mesh.normals[3 * i + 2] as number,
      ]);
      // Two-sided: a thin shell seen from inside is lit like its outside.
      const facing = dot(n, toViewer) >= 0 ? 1 : -1;
      sl[i] = 0.42 + 0.58 * Math.max(0, facing * dot(n, light));
    }
    const indices = mesh.indices;
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t] as number;
      const b = indices[t + 1] as number;
      const c = indices[t + 2] as number;
      const ax = sx[a] as number;
      const ay = sy[a] as number;
      const bx = sx[b] as number;
      const by = sy[b] as number;
      const cx = sx[c] as number;
      const cy = sy[c] as number;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (area === 0) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
      const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
      const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
      if (x0 > x1 || y0 > y1) continue;
      const inv = 1 / area;
      const az = sz[a] as number;
      const bz = sz[b] as number;
      const cz = sz[c] as number;
      const al = sl[a] as number;
      const bl = sl[b] as number;
      const cl = sl[c] as number;
      for (let y = y0; y <= y1; y++) {
        const py = y + 0.5;
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv;
          const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * az + w1 * bz + w2 * cz;
          const at = y * W + x;
          if (z > (depth[at] as number)) {
            depth[at] = z;
            owner[at] = bodyIndex;
            shade[at] = w0 * al + w1 * bl + w2 * cl;
          }
        }
      }
    }
  });

  // Shade, outline, and average the supersamples.
  const rgba = new Uint8Array(width * height * 4);
  const edgeDepth = 0.004;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < ss; j++) {
        for (let i = 0; i < ss; i++) {
          const X = x * ss + i;
          const Y = y * ss + j;
          const at = Y * W + X;
          const who = owner[at] as number;
          let colour: Rgb = background;
          let k = 1;
          if (who >= 0) {
            colour = (bodies[who] as RenderBody).colour;
            k = shade[at] as number;
          }
          // An edge: the neighbour to the right or below belongs to another body or lies at
          // another depth.
          let edge = false;
          const d = depth[at] as number;
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
          ] as const) {
            const nx = X + dx;
            const ny = Y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const other = ny * W + nx;
            const od = depth[other] as number;
            if ((owner[other] as number) !== who && od < d) edge = true;
            else if (who >= 0 && d - od > edgeDepth) edge = true;
          }
          if (edge && who >= 0) k *= 0.45;
          r += colour[0] * k;
          g += colour[1] * k;
          b += colour[2] * k;
        }
      }
      const n = ss * ss;
      const o = (y * width + x) * 4;
      rgba[o] = Math.min(255, Math.round(r / n));
      rgba[o + 1] = Math.min(255, Math.round(g / n));
      rgba[o + 2] = Math.min(255, Math.round(b / n));
      rgba[o + 3] = 255;
    }
  }
  return { width, height, rgba };
}

/**
 * Lays pictures out in a grid with a margin between them (a contact sheet), top-left first.
 */
export function contactSheet(
  rasters: readonly Raster[],
  columns: number,
  margin = 12,
  background: Rgb = [255, 255, 255],
): Raster {
  const rows = Math.ceil(rasters.length / columns);
  const colWidths: number[] = new Array<number>(columns).fill(0);
  const rowHeights: number[] = new Array<number>(rows).fill(0);
  rasters.forEach((raster, i) => {
    const c = i % columns;
    const r = Math.floor(i / columns);
    colWidths[c] = Math.max(colWidths[c] as number, raster.width);
    rowHeights[r] = Math.max(rowHeights[r] as number, raster.height);
  });
  const width = colWidths.reduce((a, b) => a + b, 0) + margin * (columns + 1);
  const height = rowHeights.reduce((a, b) => a + b, 0) + margin * (rows + 1);
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[4 * i] = background[0];
    rgba[4 * i + 1] = background[1];
    rgba[4 * i + 2] = background[2];
    rgba[4 * i + 3] = 255;
  }
  rasters.forEach((raster, i) => {
    const c = i % columns;
    const r = Math.floor(i / columns);
    let x0 = margin;
    for (let k = 0; k < c; k++) x0 += (colWidths[k] as number) + margin;
    let y0 = margin;
    for (let k = 0; k < r; k++) y0 += (rowHeights[k] as number) + margin;
    for (let y = 0; y < raster.height; y++) {
      const from = y * raster.width * 4;
      rgba.set(raster.rgba.subarray(from, from + raster.width * 4), ((y0 + y) * width + x0) * 4);
    }
  });
  return { width, height, rgba };
}
