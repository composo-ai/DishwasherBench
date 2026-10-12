/**
 * Expansion of the `'rod'` item class: a rounded rectangular section swept along a centreline,
 * with a working end (cutlery, utensils, chopsticks).
 *
 * The shank is a chain of links `handle.0`, `handle.1`, ... between consecutive nodes (see
 * `linkPart`: round, uniform or tapering bars whose rounded ends blend at the nodes). At every
 * link the width is measured horizontally across the centreline and the thickness in the
 * remaining direction, so a rod lying along +x has its width along +y and its thickness along +z.
 *
 * The head starts at the last node and continues the direction of the last link:
 *  - `spoon_bowl`: one part `head`, a shallow spherical cap of the given depth stretched to
 *    `length` by `width`, hollow side towards the thickness direction (up for a spoon lying on
 *    its back). It is a real shell, so spoons nest. Its rim meets the shank at the last node and
 *    its lowest point is `depth` below it.
 *  - `fork_tines`: `count` separate prongs `head.0`, `head.1`, ..., rooted at the last node; a
 *    prong is 4/7 as wide as the pitch between prongs, narrows to 60 % of that at its tip and is
 *    separated from its neighbours by a real gap. The end of the shank joins them when its last
 *    node is as wide as the head; a narrower shank gets a cross bar `head.root` to do so.
 *  - `blade`: two wedges, `head.0` (three quarters of the length, full height) and `head.1` (the
 *    tip, where the edge sweeps up to the spine). The spine is on the +width side and keeps the
 *    given thickness; the edge is a quarter of it (at least 0.3 mm).
 *  - `none`: nothing.
 *
 * Default surface regions: `handle`; then `bowl` (hollow side) and `bowl_back`, or `tines`, or
 * `blade`.
 *
 * Units: metres.
 */

import type { Vec3 } from '@spotless/core';
import { v3Cross, v3Length, v3Sub } from '@spotless/core';
import {
  linkPart,
  quatFromAxes,
  SIZE_TOLERANCE,
  requireFiniteVec,
  requireNonNegative,
  requirePositive,
  widthDirection,
} from './expand-util.ts';
import type { Part, RodDef, RodNode, Shape, SorProfilePoint, SurfaceRegion } from './types.ts';

/** Chord error allowed between the spoon bowl's profile and its spherical cap, metres. */
const BOWL_PROFILE_ERROR = 0.00025;
/** Share of the pitch between fork prongs taken by the gap. */
const TINE_GAP_RATIO = 0.75;
/** Width of a prong at its tip relative to its root. */
const TINE_TIP_RATIO = 0.6;
/** Share of the blade length with a straight edge. */
const BLADE_STRAIGHT_FRACTION = 0.75;
/** Thickness of the cutting edge relative to the spine, and its lower limit in metres. */
const BLADE_EDGE_RATIO = 0.25;
const BLADE_EDGE_MIN = 0.0003;

/** Expands a rod definition (see the module comment for ids and regions). */
export function expandRod(def: RodDef): Shape {
  if (def.nodes.length < 2) throw new RangeError('geometry: a rod needs at least two nodes');
  if (def.porosity !== undefined) requireNonNegative(def.porosity, 'porosity');
  def.nodes.forEach((node, i) => {
    requireFiniteVec(node.p, `rod node ${i}`);
    requirePositive(node.width, `width of rod node ${i}`);
    requirePositive(node.thickness, `thickness of rod node ${i}`);
  });
  const material = def.material;
  const parts: Part[] = [];
  for (let i = 0; i + 1 < def.nodes.length; i++) {
    const a = def.nodes[i] as RodNode;
    const b = def.nodes[i + 1] as RodNode;
    const axis = v3Sub(b.p, a.p);
    const length = v3Length(axis);
    if (!(length > 1e-9)) throw new RangeError(`geometry: rod nodes ${i} and ${i + 1} coincide`);
    const dir: Vec3 = [axis[0] / length, axis[1] / length, axis[2] / length];
    parts.push(
      linkPart(`handle.${i}`, material, a.p, b.p, widthDirection(dir), a, b, def.porosity),
    );
  }
  const regions: SurfaceRegion[] = [{ id: 'handle', part: 'handle*' }];

  // Frame of the head: d along the last link, w across (horizontal), t through the thickness.
  const last = def.nodes[def.nodes.length - 1] as RodNode;
  const before = def.nodes[def.nodes.length - 2] as RodNode;
  const lastAxis = v3Sub(last.p, before.p);
  const lastLength = v3Length(lastAxis);
  const d: Vec3 = [lastAxis[0] / lastLength, lastAxis[1] / lastLength, lastAxis[2] / lastLength];
  const w = widthDirection(d);
  const t = v3Cross(d, w);
  const at = (along: number, across: number, through: number): Vec3 => [
    last.p[0] + along * d[0] + across * w[0] + through * t[0],
    last.p[1] + along * d[1] + across * w[1] + through * t[1],
    last.p[2] + along * d[2] + across * w[2] + through * t[2],
  ];
  const head = def.head;
  switch (head.type) {
    case 'none':
      break;
    case 'spoon_bowl': {
      requirePositive(head.length, 'spoon bowl length');
      requirePositive(head.width, 'spoon bowl width');
      requirePositive(head.depth, 'spoon bowl depth');
      requirePositive(head.thickness, 'spoon bowl thickness');
      const radius = head.length / 2;
      if (!(head.depth < radius)) {
        throw new RangeError('geometry: a spoon bowl must be shallower than half its length');
      }
      // Spherical cap of rim radius `radius` and height `depth`, as a polyline.
      const sphere = (radius * radius + head.depth * head.depth) / (2 * head.depth);
      const span = Math.asin(radius / sphere);
      const step = 2 * Math.acos(1 - Math.min(0.5, BOWL_PROFILE_ERROR / sphere));
      const count = Math.min(8, Math.max(2, Math.ceil(span / step)));
      const profile: SorProfilePoint[] = [];
      for (let k = 0; k <= count; k++) {
        const alpha = (span * k) / count;
        profile.push({
          r: k === 0 ? 0 : sphere * Math.sin(alpha),
          z: sphere * (1 - Math.cos(alpha)),
          t: head.thickness,
        });
      }
      parts.push({
        id: 'head',
        prim: { kind: 'sor', profile, scaleXY: [1, head.width / head.length] },
        // Part frame: x along the spoon, y across, z towards the hollow side; origin at the
        // lowest point of the bowl, so that the rim meets the shank at the last node.
        pose: { p: at(radius, 0, -head.depth), q: quatFromAxes(d, w, t) },
        material,
        ...(def.porosity === undefined ? {} : { porosity: def.porosity }),
      });
      regions.push(
        { id: 'bowl', part: 'head', side: 'in' },
        { id: 'bowl_back', part: 'head', side: 'out' },
      );
      break;
    }
    case 'fork_tines': {
      requirePositive(head.length, 'fork tine length');
      requirePositive(head.width, 'fork head width');
      requirePositive(head.thickness, 'fork tine thickness');
      if (!Number.isInteger(head.count) || head.count < 2 || head.count > 8) {
        throw new RangeError('geometry: a fork needs between 2 and 8 tines');
      }
      // count prongs and count - 1 gaps share the width: prong + gap = pitch.
      const prong = head.width / (head.count + TINE_GAP_RATIO * (head.count - 1));
      const pitch = prong * (1 + TINE_GAP_RATIO);
      const tip = Math.max(TINE_TIP_RATIO * prong, Math.min(prong, head.thickness));
      const root = { width: prong, thickness: head.thickness };
      const end = { width: tip, thickness: head.thickness };
      const edge = Math.min(prong, head.thickness) / 2;
      // The end of the shank joins the prongs if it is as wide as the head; otherwise a bar
      // across the roots does.
      if (last.width < head.width - SIZE_TOLERANCE) {
        parts.push(
          linkPart(
            'head.root',
            material,
            at(0, -(head.width / 2 - edge), 0),
            at(0, head.width / 2 - edge, 0),
            d,
            { width: 2 * edge, thickness: head.thickness },
            { width: 2 * edge, thickness: head.thickness },
            def.porosity,
          ),
        );
      }
      for (let i = 0; i < head.count; i++) {
        const across = -head.width / 2 + prong / 2 + i * pitch;
        parts.push(
          linkPart(
            `head.${i}`,
            material,
            at(0, across, 0),
            at(head.length, across, 0),
            w,
            root,
            end,
            def.porosity,
          ),
        );
      }
      regions.push({ id: 'tines', part: 'head*' });
      break;
    }
    case 'blade': {
      requirePositive(head.length, 'blade length');
      requirePositive(head.width, 'blade height');
      requirePositive(head.thickness, 'blade thickness');
      const edgeThickness = Math.min(
        head.thickness,
        Math.max(BLADE_EDGE_RATIO * head.thickness, BLADE_EDGE_MIN),
      );
      const r = edgeThickness / 2;
      const spine = head.thickness / 2 - r; // half thickness of the core at the spine
      const top = head.width / 2 - r;
      if (!(top > 0) || !(head.length > 4 * r)) {
        throw new RangeError('geometry: the blade is too small for its thickness');
      }
      const straight = BLADE_STRAIGHT_FRACTION * head.length;
      const spinePoints = (along: number): Vec3[] =>
        spine > 1e-9 ? [at(along, top, spine), at(along, top, -spine)] : [at(along, top, 0)];
      const base = { material, ...(def.porosity === undefined ? {} : { porosity: def.porosity }) };
      const identity = { p: [0, 0, 0] as Vec3, q: [0, 0, 0, 1] as const };
      parts.push({
        ...base,
        id: 'head.0',
        prim: {
          kind: 'hull',
          points: [
            ...spinePoints(0),
            at(0, -top, 0),
            ...spinePoints(straight),
            at(straight, -top, 0),
          ],
          radius: r,
        },
        pose: identity,
      });
      parts.push({
        ...base,
        id: 'head.1',
        prim: {
          kind: 'hull',
          points: [
            ...spinePoints(straight),
            at(straight, -top, 0),
            ...spinePoints(head.length - r),
          ],
          radius: r,
        },
        pose: identity,
      });
      regions.push({ id: 'blade', part: 'head*' });
      break;
    }
  }
  return { parts, regions: def.regions ?? regions };
}
