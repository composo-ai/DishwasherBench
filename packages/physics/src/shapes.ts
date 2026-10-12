/**
 * Collision pieces to Jolt shapes: one static compound per body.
 *
 * A piece with a rounding radius is the Minkowski sum of a convex core and a sphere. Jolt
 * generates the contact points of the simulation from the flat faces of its convex shapes (see
 * `convex.ts`), so every piece is mapped to sub-shapes whose faces lie on the true surface:
 *
 * - `capsule`: a Jolt capsule (a sphere when the two ends coincide);
 * - `hull` with a radius (every wall sector of a shell of revolution is one): a sharp Jolt hull
 *   spanned by its flat faces at their true positions (a prism of the true thickness for a flat
 *   core) and a capsule along each edge of the core whose rounding is exposed. Whether it is
 *   exposed is decided over the whole body: the rim of a plate gets a capsule; an edge shared
 *   by two sectors of a smooth wall does not, and the prisms of the two sectors are mitred
 *   there instead, each ending on the plane that bisects the angle between them, so that they
 *   meet without a gap;
 * - `box` with a radius: the same, as the rounded hull of its eight corners;
 * - `hull` or `box` without a radius: a sharp Jolt hull or box;
 * - `round` (the round rolling surface of a shell of revolution): a sharp Jolt cylinder or
 *   tapered cylinder whose side is the surface, moved outwards by
 *   `JoltWorldSettings.roundSurfaceProud`. It is a solid that spans the cavity of its item; the
 *   world only lets it collide from outside and with bodies that are not dynamic (see
 *   `world.ts`), and shapes built for queries leave it out.
 * Along an edge that was left without a capsule the proxy is within
 * `JoltWorldSettings.roundedEdgeSag` (0.05 mm) of the true shape: the mitred prisms stand proud
 * of the rounded edge by `r (1 / cos(fold / 2) - 1)` at the mitre, which for the folds that get
 * no capsule is no more than the sag. (Before the prisms were mitred, each ended square to its
 * own face, and two neighbours on the convex side of a wall left a V-shaped groove between
 * them down to the mid-surface: a probe the size of a knife edge sank 1.7 mm into a mug.)
 * Elsewhere the proxy is never larger than the true shape. Sharp Jolt shapes are given a small
 * inner convex radius (`JoltWorldSettings.minConvexRadius`, reduced by Jolt where the piece is
 * thin or sharp): Jolt's contact generation is more robust with it and the bake-off was run
 * that way.
 *
 * Units: metres; pieces are in the item frame and so is the compound.
 */

import type { Mat3, Pose, Quat, Vec3 } from '@spotless/core';
import {
  poseTransformPoint,
  quatConjugate,
  quatFromMat3,
  quatFromTo,
  quatInverseRotate,
  quatMul,
  symmetricEigen3,
  v3Length,
  v3Sub,
} from '@spotless/core';
import type { CollisionPiece, CollisionSolid } from '@spotless/geometry';
import { collisionSolids } from '@spotless/geometry';
import type { CapsuleForm, CoreEdge, PolytopeForm, SphereForm } from './convex.ts';
import {
  chordSag,
  coreEdgeKey,
  exposedArc,
  facetRoundedHull,
  hullFaces,
  pointSetDimension,
} from './convex.ts';
import type { JoltModule } from './jolt-module.ts';
import { forgetJoltWrapper } from './jolt-module.ts';
import type { JoltWorldSettings } from './settings.ts';

/** A Jolt shape built from the pieces of one body, with what is needed to interpret contacts. */
export interface BuiltShape {
  /**
   * The compound shape, in engine length units (one reference is held; release it with
   * {@link releaseBuiltShape}).
   */
  readonly shape: InstanceType<JoltModule['Shape']>;
  /**
   * Centre of mass Jolt computed for the compound (uniform density), item frame, metres. The
   * shape's own coordinates are relative to this point.
   */
  readonly joltCom: Vec3;
  /** Per leaf (Jolt sub-shape that is not a compound): index of the collision piece it came from. */
  readonly leafPiece: readonly number[];
  /** Per leaf: the round rolling surface it is, or null for an ordinary sub-shape. */
  readonly leafRound: readonly (RoundSurface | null)[];
  /**
   * Bit mask that extracts, from a Jolt sub-shape id, the index among the children of the
   * compound (a leaf or a group of leaves). Use {@link leafOfSubShape} for the leaf.
   */
  readonly subShapeMask: number;
  /** Number of bits of `subShapeMask`. */
  readonly subShapeBits: number;
  /** Per child of the compound: index of its first leaf in the leaf tables. */
  readonly topFirstLeaf: Int32Array;
  /**
   * Per child of the compound: bit mask of the index of a leaf inside it, to be applied to the
   * sub-shape id shifted down by `subShapeBits`; 0 for a child that is a single leaf.
   */
  readonly topInnerMask: Uint32Array;
  /** Per child of the compound: the round rolling surface it is, or null. */
  readonly topRound: readonly (RoundSurface | null)[];
  /**
   * Per leaf: a sphere that contains it, four numbers each (centre in the item frame and
   * radius, metres). For the world's own culling of piece pairs (see `piecesMayCollide`).
   */
  readonly leafSphere: Float64Array;
  /** Per child of the compound: a sphere that contains it (all its leaves), as `leafSphere`. */
  readonly topSphere: Float64Array;
  /**
   * Per leaf: the capsule it is, seven numbers each (the two ends of its axis in the item frame
   * and its radius, metres; a sphere has its two ends in one place), or a radius of 0 for a
   * leaf that is neither. For the world's test of contacts ahead of an approach (see
   * `acceptsHit`).
   */
  readonly leafCapsule: Float64Array;
  /**
   * Per leaf: which ends of the capsule it is run on into another length of the same capsule
   * (see {@link MAX_CAPSULE_LEAF_LENGTH}): 1 for its first end, 2 for its second, 3 for both, 0
   * for neither or for a leaf that is no such length. The rounded end of a length is not part
   * of the surface of the capsule where the next length begins, and a contact found on it is
   * refused by the world (see `acceptsHit`).
   */
  readonly leafJoined: Uint8Array;
  /**
   * Per leaf: the faces of the hull or box it is, four numbers each (the unit normal pointing
   * out of it and the offset of the plane along it, item frame, metres), or null for a leaf
   * that is neither or has more than {@link FACE_SEARCH_POINTS} corners. For the same test.
   */
  readonly leafFaces: readonly (Float64Array | null)[];
  /** Radius of the smallest sphere about `joltCom` containing the shape, metres. */
  readonly boundingRadius: number;
  /** Number of sub-shapes for which Jolt's hull builder failed and the fallback was used. */
  readonly fallbacks: number;
}

/** What the world needs to know about a sub-shape that is a round rolling surface. */
export interface RoundSurface {
  /** Unit axis of the surface in the item frame, from its `a` end to its `b` end. */
  readonly axis: Vec3;
  /** Component along `axis` of the outward normal of the side of the surface. */
  readonly normalAlongAxis: number;
  /** Thickness of the wall whose outer surface it is, metres. */
  readonly wallThickness: number;
}

/** Longest capsule axis treated as a point, metres. */
const SPHERE_LENGTH = 1e-9;

/**
 * Shortest capsule, in engine length units, that is given to Jolt as a capsule. Jolt returns a
 * two-point supporting face for a capsule whenever the projections of its two ends on the contact
 * normal differ by less than a hard-coded 0.02 units (`cCapsuleProjectionSlop`), which for a
 * capsule shorter than that is always, even when it is hit end-on; the contact manifold built
 * from that face is then degenerate (measured: contact points 10^9 km away and a bowl launched at
 * 500 m/s). Shorter capsules become two spheres at their ends.
 */
export const MIN_CAPSULE_LENGTH_UNITS = 0.025;

/**
 * Longest capsule handed to the engine in one piece, metres; a longer one is cut into equal
 * lengths no longer than this, end to end (the same solid: the spherical ends of two
 * consecutive lengths lie inside the next). The engine tests the pieces of two bodies in a
 * nested loop: for every piece of the second body that is near the first, every piece of the
 * first whose box overlaps the box of that piece *in the frame of the first body*. The box of a
 * 0.5 m rail or a 0.14 m floor wire seen from the frame of a plate that leans and is turned is
 * larger than the plate, so every piece of the plate was tested against every wire under it:
 * 10,000 to 40,000 pairs per step for one plate on a basket [MEASURED here,
 * integration/scripts/place-times.ts]. Cut to this length, a wire costs the pieces near it.
 * 40 mm is about the size of the wall pieces of a plate, below which shorter lengths only add
 * pieces.
 */
export const MAX_CAPSULE_LEAF_LENGTH = 0.04;

/**
 * Most lengths a capsule is cut into. A rail of half a metre is 13; the edges of the 100 m
 * slab that stands for the kitchen floor are 16 lengths of six metres and not 2,500 of 40 mm.
 */
export const MAX_CAPSULE_LEAVES = 16;

/**
 * Most leaves of a group that is searched leaf by leaf (four boxes at a time); a larger group
 * gets a tree. With 2,500 leaves searched one by one, one such group cost 5 ms in every step
 * of an item that merely lay near it [MEASURED here].
 */
export const SMALL_GROUP_LEAVES = 16;

/**
 * Most corners of a hull whose faces are worked out for the world's test of contacts ahead of
 * an approach (`BuiltShape.leafFaces`): the search goes with the fourth power of the number.
 * Wall sectors have 8 to 12, the solid of a rounded box 24; the floor of a plate, with two
 * corners per sector, is left out and is flat anyway.
 */
export const FACE_SEARCH_POINTS = 24;

/** Number of equal lengths a capsule of the given length goes to the engine in. */
export function capsuleLeafCount(length: number): number {
  return Math.min(
    MAX_CAPSULE_LEAVES,
    Math.max(1, Math.ceil(length / MAX_CAPSULE_LEAF_LENGTH - 1e-9)),
  );
}

/**
 * A hull is given to the engine in a frame of its own (its principal axes) when its box in
 * that frame has less than this fraction of the volume of its box in the item frame. The
 * engine bounds every piece by a box in the piece's frame, and carries that box into the frame
 * of the other body for the nested loop described at {@link MAX_CAPSULE_LEAF_LENGTH}: the
 * wall sector of a plate at 45 degrees of azimuth has a box of eight times its own volume in
 * the item frame.
 */
export const OWN_FRAME_VOLUME_FRACTION = 0.8;

/**
 * The centroid and the principal axes of a point set: the frame in which it has (nearly) its
 * smallest box. Null for fewer than four points or points that all coincide.
 */
export function principalFrameOf(points: readonly Vec3[]): Pose | null {
  const n = points.length;
  if (n < 4) return null;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const p of points) {
    cx += p[0];
    cy += p[1];
    cz += p[2];
  }
  cx /= n;
  cy /= n;
  cz /= n;
  let xx = 0;
  let xy = 0;
  let xz = 0;
  let yy = 0;
  let yz = 0;
  let zz = 0;
  for (const p of points) {
    const x = p[0] - cx;
    const y = p[1] - cy;
    const z = p[2] - cz;
    xx += x * x;
    xy += x * y;
    xz += x * z;
    yy += y * y;
    yz += y * z;
    zz += z * z;
  }
  if (!(xx + yy + zz > 0)) return null;
  const covariance: Mat3 = [xx, xy, xz, xy, yy, yz, xz, yz, zz];
  return { p: [cx, cy, cz], q: quatFromMat3(symmetricEigen3(covariance).vectors) };
}

/** Volume of the box of a point set in a frame (the item frame when `frame` is null). */
function boxVolume(points: readonly Vec3[], frame: Pose | null): number {
  const lo: [number, number, number] = [Infinity, Infinity, Infinity];
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    const p = frame === null ? point : quatInverseRotate(frame.q, v3Sub(point, frame.p));
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i] as number, p[i] as number);
      hi[i] = Math.max(hi[i] as number, p[i] as number);
    }
  }
  return (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);
}

/**
 * The principal frame of a point set ({@link principalFrameOf}) when its box in that frame has
 * less than {@link OWN_FRAME_VOLUME_FRACTION} of the volume of its box in the frame the points
 * are given in; null otherwise.
 */
export function ownFrameOf(points: readonly Vec3[]): Pose | null {
  const frame = principalFrameOf(points);
  if (frame === null) return null;
  return boxVolume(points, frame) < OWN_FRAME_VOLUME_FRACTION * boxVolume(points, null)
    ? frame
    : null;
}

/** A sharp box sub-shape. */
export interface BoxLeaf {
  readonly kind: 'box';
  /** Half extents, metres. */
  readonly halfExtents: Vec3;
  /** Box frame to item frame. */
  readonly pose: Pose;
}

/**
 * A round rolling surface: the solid frustum between the circle of radius `radiusA` about `a`
 * and the circle of radius `radiusB` about `b` (item frame, metres), whose side is the surface.
 */
export interface ConeLeaf {
  readonly kind: 'cone';
  readonly a: Vec3;
  readonly b: Vec3;
  readonly radiusA: number;
  readonly radiusB: number;
  /** Thickness of the wall whose outer surface the side is, metres. */
  readonly wallThickness: number;
}

/** One Jolt sub-shape of a body, before it is created. */
export type Leaf = SphereForm | CapsuleForm | PolytopeForm | BoxLeaf | ConeLeaf;

/** A planned sub-shape and the collision piece it belongs to. */
export interface PlannedLeaf {
  readonly leaf: Leaf;
  /** Index of the collision piece contacts with this sub-shape are attributed to. */
  readonly piece: number;
}

interface PieceParts {
  /** Sub-shapes that belong to this piece alone. */
  readonly own: Leaf[];
  /** Edges of the piece's core, which neighbouring pieces may share. */
  readonly edges: readonly CoreEdge[];
  /**
   * For a piece whose core is a flat polygon and whose first sub-shape is the prism over it:
   * the rounding radius. The edges are then the polygon, in order, counter-clockwise about its
   * normal.
   */
  readonly flat?: number;
}

function capsuleLeaf(a: Vec3, b: Vec3, radius: number): SphereForm | CapsuleForm {
  return v3Length(v3Sub(b, a)) < SPHERE_LENGTH
    ? { kind: 'sphere', centre: a, radius }
    : { kind: 'capsule', a, b, radius };
}

function roundedHullParts(points: readonly Vec3[], radius: number, sag: number): PieceParts {
  const form = facetRoundedHull(points, radius, sag);
  if (form.kind !== 'faceted') return { own: [form], edges: [] };
  if (form.solid === null) return { own: [], edges: form.edges };
  // The edges of a flat core all have a quarter turn of the piece on either side.
  const isFlat = form.edges.every((edge) => edge.halfAngle === Math.PI / 2);
  return isFlat
    ? { own: [form.solid], edges: form.edges, flat: radius }
    : { own: [form.solid], edges: form.edges };
}

/** Unit normal of a flat core from one of its edges: `(b - a) x inward`. */
function flatNormal(edge: CoreEdge): Vec3 {
  const e = v3Sub(edge.b, edge.a);
  const n: Vec3 = [
    e[1] * edge.inward[2] - e[2] * edge.inward[1],
    e[2] * edge.inward[0] - e[0] * edge.inward[2],
    e[0] * edge.inward[1] - e[1] * edge.inward[0],
  ];
  const length = v3Length(n);
  return [n[0] / length, n[1] / length, n[2] / length];
}

/**
 * The prism over a flat core whose side faces along some edges are mitred: `edges` is the
 * polygon of the core in order, `radius` the rounding radius, and `sides[i]` the unit normal of
 * the plane through edge `i` on which the prism ends there (pointing out of the polygon), or
 * undefined for a side square to the core. Each corner of the prism is where its top or bottom
 * face meets the side planes of the two edges at that corner of the polygon. Returns null when
 * a corner is ill-defined or would stand further out than `limit` times the radius.
 */
export function mitredPrism(
  edges: readonly CoreEdge[],
  radius: number,
  sides: readonly (Vec3 | undefined)[],
  limit = 1.5,
): Vec3[] | null {
  const first = edges[0];
  if (first === undefined) return null;
  const n = flatNormal(first);
  const side = (i: number): Vec3 => {
    const given = sides[i];
    if (given !== undefined) return given;
    const edge = edges[i] as CoreEdge;
    return [-edge.inward[0], -edge.inward[1], -edge.inward[2]];
  };
  const out: Vec3[] = [];
  for (let i = 0; i < edges.length; i++) {
    const corner = (edges[i] as CoreEdge).a;
    const m1 = side((i + edges.length - 1) % edges.length);
    const m2 = side(i);
    // d with n.d = 1, m1.d = 0, m2.d = 0: along m1 x m2.
    const cx = m1[1] * m2[2] - m1[2] * m2[1];
    const cy = m1[2] * m2[0] - m1[0] * m2[2];
    const cz = m1[0] * m2[1] - m1[1] * m2[0];
    const along = n[0] * cx + n[1] * cy + n[2] * cz;
    const reach = Math.hypot(cx, cy, cz) / Math.abs(along);
    if (!(Math.abs(along) > 1e-9) || !(reach <= limit)) return null;
    const k = radius / along;
    out.push(
      [corner[0] + k * cx, corner[1] + k * cy, corner[2] + k * cz],
      [corner[0] - k * cx, corner[1] - k * cy, corner[2] - k * cz],
    );
  }
  return out;
}

/**
 * The engine's form of a round rolling surface: the frustum with its side moved outwards along
 * its normal by `proud` metres (see `JoltWorldSettings.roundSurfaceProud`).
 */
export function coneLeafOf(
  piece: Extract<CollisionPiece, { kind: 'round' }>,
  proud: number,
): ConeLeaf {
  const axis = v3Sub(piece.b, piece.a);
  const height = v3Length(axis);
  if (
    !(height > 0) ||
    !(piece.radiusA >= 0) ||
    !(piece.radiusB >= 0) ||
    !(piece.wallThickness > 0) ||
    !Number.isFinite(height + piece.radiusA + piece.radiusB + piece.wallThickness)
  ) {
    throw new Error(`physics: round surface '${piece.part}' has invalid dimensions`);
  }
  const slant = Math.hypot(height, piece.radiusB - piece.radiusA);
  // Outward normal of the side: its radial part and its part along the axis from a to b.
  const radial = height / slant;
  const along = -(piece.radiusB - piece.radiusA) / slant;
  const shift = (proud * along) / height;
  const moved = (p: Vec3): Vec3 => [
    p[0] + shift * axis[0],
    p[1] + shift * axis[1],
    p[2] + shift * axis[2],
  ];
  return {
    kind: 'cone',
    a: moved(piece.a),
    b: moved(piece.b),
    radiusA: piece.radiusA + proud * radial,
    radiusB: piece.radiusB + proud * radial,
    wallThickness: piece.wallThickness,
  };
}

function partsOf(piece: CollisionPiece, settings: JoltWorldSettings): PieceParts {
  if (piece.kind === 'round') {
    return { own: [coneLeafOf(piece, settings.roundSurfaceProud)], edges: [] };
  }
  if (!(piece.radius >= 0) || !Number.isFinite(piece.radius)) {
    throw new Error(`physics: piece '${piece.part}' has an invalid radius ${piece.radius}`);
  }
  switch (piece.kind) {
    case 'capsule':
      if (!(piece.radius > 0)) {
        throw new Error(`physics: capsule '${piece.part}' needs a radius above zero`);
      }
      return { own: [capsuleLeaf(piece.a, piece.b, piece.radius)], edges: [] };
    case 'box': {
      const h = piece.halfExtents;
      for (const x of h) {
        if (!(x >= 0) || !Number.isFinite(x)) {
          throw new Error(`physics: box '${piece.part}' has an invalid half extent`);
        }
      }
      if (piece.radius === 0) {
        if (!(Math.min(h[0], h[1], h[2]) > 0)) {
          throw new Error(`physics: box '${piece.part}' has no volume`);
        }
        return { own: [{ kind: 'box', halfExtents: h, pose: piece.pose }], edges: [] };
      }
      const corners: Vec3[] = [];
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            corners.push(poseTransformPoint(piece.pose, [sx * h[0], sy * h[1], sz * h[2]]));
          }
        }
      }
      return roundedHullParts(corners, piece.radius, settings.roundedEdgeSag);
    }
    case 'hull':
      if (piece.radius === 0) {
        if (pointSetDimension(piece.points).dim !== 3) {
          throw new Error(
            `physics: hull '${piece.part}' is flat and has no radius, so it has no volume`,
          );
        }
        return { own: [{ kind: 'polytope', points: piece.points }], edges: [] };
      }
      return roundedHullParts(piece.points, piece.radius, settings.roundedEdgeSag);
  }
}

/**
 * Plans the Jolt sub-shapes of a list of collision pieces (item frame, metres): the faithful
 * split described at the top of this file. The flat parts come first, in the order of the
 * pieces; then one capsule for every core edge whose rounding is exposed by more than
 * `settings.roundedEdgeSag`, with the largest radius asked for by the pieces sharing the edge
 * and attributed to the first of them that has that radius. Where two flat pieces of one
 * thickness share an edge that gets no capsule, their prisms are mitred there (see
 * {@link mitredPrism}). The result is a function of the pieces and their order only.
 */
export function planLeaves(
  pieces: readonly CollisionPiece[],
  settings: JoltWorldSettings,
): PlannedLeaf[] {
  const sag = settings.roundedEdgeSag;
  const planned: PlannedLeaf[] = [];
  const shared = new Map<string, { edges: CoreEdge[]; pieces: number[] }>();
  // Pieces with a flat core and a prism over it: where the prism is in `planned`, its polygon,
  // and the planes its sides end on where they are mitred (by the key of the edge).
  const flats = new Map<
    number,
    { at: number; radius: number; edges: readonly CoreEdge[]; sides: Map<string, Vec3> }
  >();
  for (let index = 0; index < pieces.length; index++) {
    const { own, edges, flat } = partsOf(pieces[index] as CollisionPiece, settings);
    if (flat !== undefined) {
      flats.set(index, { at: planned.length, radius: flat, edges, sides: new Map() });
    }
    for (const leaf of own) planned.push({ leaf, piece: index });
    for (const edge of edges) {
      // An edge of no length is a corner, which the capsules of the adjoining edges round.
      const key = coreEdgeKey(edge.a, edge.b);
      if (key === null) continue;
      let group = shared.get(key);
      if (group === undefined) {
        group = { edges: [], pieces: [] };
        shared.set(key, group);
      }
      group.edges.push(edge);
      group.pieces.push(index);
    }
  }
  for (const [key, group] of shared) {
    let radius = 0;
    for (const edge of group.edges) radius = Math.max(radius, edge.radius);
    // A thinner neighbour closes the edge only up to its own radius: it does not count.
    const closing = group.edges.filter((edge) => edge.radius >= radius - sag);
    // The fold between two flat pieces of one thickness (two sectors of a wall) is allowed
    // more than the edge of a solid: their prisms are mitred there, see below.
    const a = flats.get(group.pieces[0] as number);
    const b = flats.get(group.pieces[1] as number);
    const fold =
      group.edges.length === 2 &&
      a !== undefined &&
      b !== undefined &&
      a !== b &&
      Math.abs(a.radius - b.radius) <= sag;
    if (chordSag(radius, exposedArc(closing)) <= (fold ? settings.roundedFoldSag : sag)) {
      // No capsule. Where exactly two flat pieces of one thickness meet here, their prisms are
      // mitred: both end on the plane through the edge that bisects the angle between them.
      if (fold && a !== undefined && b !== undefined) {
        const ea = group.edges[0] as CoreEdge;
        const eb = group.edges[1] as CoreEdge;
        // The bisecting plane contains the edge and the direction midway between the two
        // pieces as seen from the edge: its normal is the difference of their inward vectors.
        const m = v3Sub(eb.inward, ea.inward);
        const length = v3Length(m);
        if (length > 1e-9) {
          // Out of piece a is towards piece b, and the other way round.
          a.sides.set(key, [m[0] / length, m[1] / length, m[2] / length]);
          b.sides.set(key, [-m[0] / length, -m[1] / length, -m[2] / length]);
        }
      }
      continue;
    }
    const owner = group.edges.findIndex((edge) => edge.radius === radius);
    const first = group.edges[owner] as CoreEdge;
    planned.push({
      leaf: capsuleLeaf(first.a, first.b, radius),
      piece: group.pieces[owner] as number,
    });
  }
  for (const [index, flat] of flats) {
    if (flat.sides.size === 0) continue;
    const sides = flat.edges.map((edge) => {
      const key = coreEdgeKey(edge.a, edge.b);
      return key === null ? undefined : flat.sides.get(key);
    });
    const points = mitredPrism(flat.edges, flat.radius, sides);
    if (points === null) continue;
    planned[flat.at] = { leaf: { kind: 'polytope', points, fallback: 'drop' }, piece: index };
  }
  return planned;
}

/** Leaves that go into the engine together, as one compound in a frame of its own. */
export interface LeafGroup {
  /** Group frame to item frame. */
  readonly frame: Pose;
  /** Indices of the members in the list of planned leaves, ascending. */
  readonly members: readonly number[];
}

function leafCentre(leaf: Leaf): Vec3 {
  switch (leaf.kind) {
    case 'sphere':
      return leaf.centre;
    case 'capsule':
    case 'cone':
      return [
        (leaf.a[0] + leaf.b[0]) / 2,
        (leaf.a[1] + leaf.b[1]) / 2,
        (leaf.a[2] + leaf.b[2]) / 2,
      ];
    case 'box':
      return leaf.pose.p;
    case 'polytope': {
      let x = 0;
      let y = 0;
      let z = 0;
      for (const p of leaf.points) {
        x += p[0];
        y += p[1];
        z += p[2];
      }
      const n = leaf.points.length;
      return [x / n, y / n, z / n];
    }
  }
}

/**
 * Gathers the planned leaves of a body into groups (see {@link buildShape} for why): the
 * result lists what the body's compound holds, in order, each entry either the index of a
 * leaf on its own or a group.
 *
 * A group is what one collision piece became: the flat-faced solid of a rounded hull or box
 * with the capsules along its exposed edges, in the principal frame of the solid (the frame of
 * a wall sector of a plate: across it, along it and through it). A solid without capsules is a
 * group of one when that frame bounds it more tightly than the item frame does
 * ({@link OWN_FRAME_VOLUME_FRACTION}). Round rolling surfaces, lone capsules and spheres, and
 * solids that lie square in the item frame stay on their own. The result is a function of the
 * pieces and their order only.
 */
export function groupLeaves(planned: readonly PlannedLeaf[]): (number | LeafGroup)[] {
  const byPiece = new Map<number, number[]>();
  for (let index = 0; index < planned.length; index++) {
    const { leaf, piece } = planned[index] as PlannedLeaf;
    if (leaf.kind === 'cone') continue;
    let members = byPiece.get(piece);
    if (members === undefined) {
      members = [];
      byPiece.set(piece, members);
    }
    members.push(index);
  }
  const out: (number | LeafGroup)[] = [];
  const placed = new Set<number>();
  for (let index = 0; index < planned.length; index++) {
    const { leaf, piece } = planned[index] as PlannedLeaf;
    const members = byPiece.get(piece);
    if (leaf.kind === 'cone' || members === undefined) {
      out.push(index);
      continue;
    }
    if (placed.has(piece)) continue;
    // The frame of the piece: that of its solid, or of its first capsule.
    let solid: Leaf | undefined;
    for (const member of members) {
      const candidate = (planned[member] as PlannedLeaf).leaf;
      if (candidate.kind === 'polytope' || candidate.kind === 'box') {
        solid = candidate;
        break;
      }
    }
    let frame: Pose | null = null;
    let tighter = false;
    if (solid !== undefined && solid.kind === 'polytope') {
      frame = principalFrameOf(solid.points);
      tighter = ownFrameOf(solid.points) !== null;
    } else if (solid !== undefined && solid.kind === 'box') {
      frame = solid.pose;
    } else if (leaf.kind === 'capsule') {
      frame = { p: leafCentre(leaf), q: quatFromTo([0, 1, 0], v3Sub(leaf.b, leaf.a)) };
    }
    if (frame === null || (members.length < 2 && !tighter)) {
      // On its own (the other leaves of the piece, if any, follow at their own turn).
      out.push(index);
      if (members.length > 1)
        byPiece.set(
          piece,
          members.filter((m) => m !== index),
        );
      continue;
    }
    placed.add(piece);
    out.push({ frame, members });
  }
  return out;
}

/** A leaf as seen from a frame given by its pose in the frame the leaf is in. */
function leafInFrame(leaf: Leaf, frame: Pose): Leaf {
  const point = (p: Vec3): Vec3 => quatInverseRotate(frame.q, v3Sub(p, frame.p));
  switch (leaf.kind) {
    case 'sphere':
      return { ...leaf, centre: point(leaf.centre) };
    case 'capsule':
    case 'cone':
      return { ...leaf, a: point(leaf.a), b: point(leaf.b) };
    case 'box':
      return {
        ...leaf,
        pose: { p: point(leaf.pose.p), q: quatMul(quatConjugate(frame.q), leaf.pose.q) },
      };
    case 'polytope':
      return leaf.fallback === undefined || leaf.fallback === 'drop'
        ? { ...leaf, points: leaf.points.map(point) }
        : { ...leaf, points: leaf.points.map(point), fallback: leaf.fallback.map(point) };
  }
}

/**
 * Builds the Jolt compound of a list of collision pieces. Throws on an empty list, on a piece
 * without volume and when Jolt rejects a shape that has no fallback.
 *
 * The compound has two levels. The engine tests two bodies piece against piece in a nested
 * loop: every piece of the second body whose box overlaps the first body, against every piece
 * of the first whose box, *in the frame of the first body*, overlaps the box of that piece.
 * The wall sector of a plate at 45 degrees of azimuth fills an eighth of its box in the item
 * frame, so that a wire or the sector of another plate anywhere near it was tested against
 * about a third of all the pieces of the plate (measured: 40,000 to 95,000 tests in one step
 * for one dessert plate coming to rest across the cutlery basket). So the leaves are gathered
 * into groups ({@link groupLeaves}), each a compound of its own in a frame in which its leaves
 * are bounded tightly; the outer loop then meets a group as a whole and the inner one sees the
 * leaves of a group in the group's frame.
 */
export function buildShape(
  jolt: JoltModule,
  pieces: readonly CollisionPiece[],
  settings: JoltWorldSettings,
): BuiltShape {
  if (pieces.length === 0) throw new Error('physics: a body needs at least one collision piece');
  const planned = planLeaves(pieces, settings);
  const layout = groupLeaves(planned);
  // Everything handed to the engine is in engine length units.
  const scale = settings.engineLengthScale;
  const vec = new jolt.Vec3(0, 0, 0);
  const rot = new jolt.Quat(0, 0, 0, 1);
  const compound = new jolt.StaticCompoundShapeSettings();
  compound.AddRef();
  type CompoundSettings = InstanceType<JoltModule['CompoundShapeSettings']>;
  // The engine frees shape settings and intermediate shapes by reference count, which leaves
  // their JavaScript wrappers in the bindings' tables; they are taken out again at the end.
  const spent: [unknown, unknown][] = [[jolt.StaticCompoundShapeSettings, compound]];
  /** Notes a wrapper object of class `wrapperClass` for removal and returns it. */
  const temporary = <T>(wrapperClass: unknown, object: T): T => {
    spent.push([wrapperClass, object]);
    return object;
  };
  const leafPiece: number[] = [];
  const leafRound: (RoundSurface | null)[] = [];
  const leafSpheres: number[] = [];
  const leafCapsules: number[] = [];
  const leafJoined: number[] = [];
  const leafFaces: (Float64Array | null)[] = [];
  const topFirstLeaf: number[] = [];
  const topLeafCount: number[] = [];
  let fallbacks = 0;

  /** A hull of `points` (one reference held for the caller), or the hull builder's complaint. */
  const hullOf = (
    points: readonly Vec3[],
  ): { shape: InstanceType<JoltModule['Shape']> | null; error: string } => {
    const hull = temporary(jolt.ConvexHullShapeSettings, new jolt.ConvexHullShapeSettings());
    hull.AddRef();
    try {
      for (const p of points) {
        vec.Set(p[0] * scale, p[1] * scale, p[2] * scale);
        hull.mPoints.push_back(vec);
      }
      hull.mHullTolerance = settings.hullTolerance * scale;
      hull.mMaxConvexRadius = settings.minConvexRadius * scale;
      hull.mMaxErrorConvexRadius = settings.sharpPieceMaxError * scale;
      const result = hull.Create();
      if (result.HasError()) return { shape: null, error: result.GetError().c_str() };
      const shape = temporary(jolt.Shape, result.Get());
      shape.AddRef();
      return { shape, error: '' };
    } finally {
      hull.Release();
    }
  };

  /**
   * Adds the engine's sub-shapes of one planned leaf (given in the frame of `target`) to the
   * compound `target`, and one entry per sub-shape to the leaf tables.
   */
  const addLeaf = (
    target: CompoundSettings,
    leaf: Leaf,
    piece: number,
    frame: Pose | null,
  ): void => {
    let position: Vec3 = [0, 0, 0];
    let rotation: Quat = [0, 0, 0, 1];
    const name = (pieces[piece] as CollisionPiece).part;
    /**
     * Notes the sphere (centre in the frame of `target`) that bounds the sub-shape added, and
     * the capsule it is (ends in the frame of `target`), if it is one.
     */
    const bound = (
      centre: Vec3,
      radius: number,
      capsule?: [Vec3, Vec3, number],
      corners?: readonly Vec3[],
      joined = 0,
    ): void => {
      const c = frame === null ? centre : poseTransformPoint(frame, centre);
      leafSpheres.push(c[0], c[1], c[2], radius);
      leafJoined.push(joined);
      if (corners === undefined || corners.length > FACE_SEARCH_POINTS) {
        leafFaces.push(null);
      } else {
        const inItem = corners.map((corner) =>
          frame === null ? corner : poseTransformPoint(frame, corner),
        );
        const faces = hullFaces(inItem);
        const flat = new Float64Array(4 * faces.length);
        faces.forEach((face, k) => {
          flat.set([face.normal[0], face.normal[1], face.normal[2], face.offset], 4 * k);
        });
        leafFaces.push(flat);
      }
      if (capsule === undefined) {
        leafCapsules.push(0, 0, 0, 0, 0, 0, 0);
      } else {
        const a = frame === null ? capsule[0] : poseTransformPoint(frame, capsule[0]);
        const b = frame === null ? capsule[1] : poseTransformPoint(frame, capsule[1]);
        leafCapsules.push(a[0], a[1], a[2], b[0], b[1], b[2], capsule[2]);
      }
    };
    const addSphere = (centre: Vec3, radius: number): void => {
      vec.Set(centre[0] * scale, centre[1] * scale, centre[2] * scale);
      rot.Set(0, 0, 0, 1);
      target.AddShape(
        vec,
        rot,
        temporary(jolt.SphereShapeSettings, new jolt.SphereShapeSettings(radius * scale)),
        leafPiece.length,
      );
      leafPiece.push(piece);
      leafRound.push(null);
      bound(centre, radius, [centre, centre, radius]);
    };
    switch (leaf.kind) {
      case 'sphere':
        addSphere(leaf.centre, leaf.radius);
        break;
      case 'capsule': {
        const axis = v3Sub(leaf.b, leaf.a);
        const length = v3Length(axis);
        if (length * scale < MIN_CAPSULE_LENGTH_UNITS) {
          // See MIN_CAPSULE_LENGTH_UNITS: too short to be a Jolt capsule.
          addSphere(leaf.a, leaf.radius);
          addSphere(leaf.b, leaf.radius);
          break;
        }
        rotation = quatFromTo([0, 1, 0], axis); // Jolt capsules lie along their local y axis
        // A long capsule goes in as equal lengths end to end (MAX_CAPSULE_LEAF_LENGTH).
        const parts = capsuleLeafCount(length);
        const halfLength = length / parts / 2;
        for (let k = 0; k < parts; k++) {
          const t = (k + 0.5) / parts;
          position = [leaf.a[0] + t * axis[0], leaf.a[1] + t * axis[1], leaf.a[2] + t * axis[2]];
          vec.Set(position[0] * scale, position[1] * scale, position[2] * scale);
          rot.Set(rotation[0], rotation[1], rotation[2], rotation[3]);
          target.AddShape(
            vec,
            rot,
            temporary(
              jolt.CapsuleShapeSettings,
              new jolt.CapsuleShapeSettings(halfLength * scale, leaf.radius * scale),
            ),
            leafPiece.length,
          );
          leafPiece.push(piece);
          leafRound.push(null);
          const reach = halfLength / length;
          bound(
            position,
            halfLength + leaf.radius,
            [
              [
                position[0] - reach * axis[0],
                position[1] - reach * axis[1],
                position[2] - reach * axis[2],
              ],
              [
                position[0] + reach * axis[0],
                position[1] + reach * axis[1],
                position[2] + reach * axis[2],
              ],
              leaf.radius,
            ],
            undefined,
            (k > 0 ? 1 : 0) | (k < parts - 1 ? 2 : 0),
          );
        }
        break;
      }
      case 'cone': {
        const axis = v3Sub(leaf.b, leaf.a);
        const height = v3Length(axis);
        position = [
          (leaf.a[0] + leaf.b[0]) / 2,
          (leaf.a[1] + leaf.b[1]) / 2,
          (leaf.a[2] + leaf.b[2]) / 2,
        ];
        // Jolt's (tapered) cylinder stands along its local y axis about its mid-height, the
        // top radius at +y. Sharp (no convex radius): its side is then exactly the surface,
        // and so is the line Jolt builds the contact from.
        rotation = quatFromTo([0, 1, 0], axis);
        vec.Set(position[0] * scale, position[1] * scale, position[2] * scale);
        rot.Set(rotation[0], rotation[1], rotation[2], rotation[3]);
        target.AddShape(
          vec,
          rot,
          temporary(
            jolt.TaperedCylinderShapeSettings,
            new jolt.TaperedCylinderShapeSettings(
              (height / 2) * scale,
              leaf.radiusB * scale,
              leaf.radiusA * scale,
              0,
            ),
          ),
          leafPiece.length,
        );
        leafPiece.push(piece);
        leafRound.push({
          axis: [axis[0] / height, axis[1] / height, axis[2] / height],
          normalAlongAxis:
            -(leaf.radiusB - leaf.radiusA) / Math.hypot(height, leaf.radiusB - leaf.radiusA),
          wallThickness: leaf.wallThickness,
        });
        bound(position, Math.hypot(height / 2, Math.max(leaf.radiusA, leaf.radiusB)));
        break;
      }
      case 'box': {
        const h = leaf.halfExtents;
        // A sharp box gets the minimum rounding, limited to a quarter of its thinnest half
        // extent (the bake-off's rule).
        const convexRadius = Math.min(settings.minConvexRadius, 0.25 * Math.min(h[0], h[1], h[2]));
        vec.Set(h[0] * scale, h[1] * scale, h[2] * scale);
        const box = temporary(
          jolt.BoxShapeSettings,
          new jolt.BoxShapeSettings(vec, convexRadius * scale),
        );
        position = leaf.pose.p;
        rotation = leaf.pose.q;
        vec.Set(position[0] * scale, position[1] * scale, position[2] * scale);
        rot.Set(rotation[0], rotation[1], rotation[2], rotation[3]);
        target.AddShape(vec, rot, box, leafPiece.length);
        leafPiece.push(piece);
        leafRound.push(null);
        const corners: Vec3[] = [];
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            for (const sz of [-1, 1]) {
              corners.push(poseTransformPoint(leaf.pose, [sx * h[0], sy * h[1], sz * h[2]]));
            }
          }
        }
        bound(position, Math.hypot(h[0], h[1], h[2]), undefined, corners);
        break;
      }
      case 'polytope': {
        // Hulls are created one by one so that a failure of Jolt's hull builder can be met
        // with the leaf's fallback instead of losing the whole body. Each is given in a frame
        // of its own where that bounds it more tightly (OWN_FRAME_VOLUME_FRACTION).
        let own = ownFrameOf(leaf.points);
        let used = leaf.points;
        const inFrame = (points: readonly Vec3[], pose: Pose | null): readonly Vec3[] =>
          pose === null ? points : points.map((p) => quatInverseRotate(pose.q, v3Sub(p, pose.p)));
        let built = hullOf(inFrame(leaf.points, own));
        if (built.shape === null) {
          const reason = built.error;
          if (leaf.fallback === undefined) {
            throw new Error(`physics: Jolt rejected the hull of piece '${name}': ${reason}`);
          }
          fallbacks++;
          if (leaf.fallback === 'drop') break;
          own = ownFrameOf(leaf.fallback);
          used = leaf.fallback;
          built = hullOf(inFrame(leaf.fallback, own));
          if (built.shape === null) {
            throw new Error(
              `physics: Jolt rejected the hull of piece '${name}': ${reason}; and its ` +
                `fallback: ${built.error}`,
            );
          }
        }
        if (own === null) {
          vec.Set(0, 0, 0);
          rot.Set(0, 0, 0, 1);
        } else {
          vec.Set(own.p[0] * scale, own.p[1] * scale, own.p[2] * scale);
          rot.Set(own.q[0], own.q[1], own.q[2], own.q[3]);
        }
        target.AddShapeShape(vec, rot, built.shape, leafPiece.length);
        // The compound settings now hold the shape.
        built.shape.Release();
        leafPiece.push(piece);
        leafRound.push(null);
        // About the mean of its points, out to the farthest of them.
        let mx = 0;
        let my = 0;
        let mz = 0;
        for (const q of used) {
          mx += q[0];
          my += q[1];
          mz += q[2];
        }
        mx /= used.length;
        my /= used.length;
        mz /= used.length;
        let far = 0;
        for (const q of used) far = Math.max(far, Math.hypot(q[0] - mx, q[1] - my, q[2] - mz));
        bound([mx, my, mz], far, undefined, used);
        break;
      }
    }
  };

  try {
    for (const item of layout) {
      const first = leafPiece.length;
      let entry = item;
      if (typeof entry === 'number') {
        const { leaf, piece } = planned[entry] as PlannedLeaf;
        const length = leaf.kind === 'capsule' ? v3Length(v3Sub(leaf.b, leaf.a)) : 0;
        if (leaf.kind === 'capsule' && capsuleLeafCount(length) > 1) {
          // A long capsule becomes several lengths: a group of them, in a frame along it.
          entry = {
            frame: {
              p: leafCentre(leaf),
              q: quatFromTo([0, 1, 0], v3Sub(leaf.b, leaf.a)),
            },
            members: [entry],
          };
        } else {
          addLeaf(compound, leaf, piece, null);
          // Usually one sub-shape; a very short capsule is two spheres, each a child.
          for (let k = first; k < leafPiece.length; k++) {
            topFirstLeaf.push(k);
            topLeafCount.push(1);
          }
          continue;
        }
      }
      // A small group is a compound without a tree of its own, which is also the kind that
      // stays a compound when it holds a single leaf: Jolt replaces a static compound of one
      // by its child, which would lose the box in the group's frame that the group exists
      // for. A large one gets the tree.
      let expected = 0;
      for (const member of entry.members) {
        const { leaf } = planned[member] as PlannedLeaf;
        expected += leaf.kind === 'capsule' ? capsuleLeafCount(v3Length(v3Sub(leaf.b, leaf.a))) : 1;
      }
      const small = expected <= SMALL_GROUP_LEAVES;
      const group = small
        ? new jolt.MutableCompoundShapeSettings()
        : new jolt.StaticCompoundShapeSettings();
      temporary(
        small ? jolt.MutableCompoundShapeSettings : jolt.StaticCompoundShapeSettings,
        group,
      );
      group.AddRef();
      try {
        for (const member of entry.members) {
          const { leaf, piece } = planned[member] as PlannedLeaf;
          addLeaf(group, leafInFrame(leaf, entry.frame), piece, entry.frame);
        }
        if (leafPiece.length === first) continue;
        const f = entry.frame;
        vec.Set(f.p[0] * scale, f.p[1] * scale, f.p[2] * scale);
        rot.Set(f.q[0], f.q[1], f.q[2], f.q[3]);
        compound.AddShape(vec, rot, group, topFirstLeaf.length);
      } finally {
        group.Release();
      }
      topFirstLeaf.push(first);
      topLeafCount.push(leafPiece.length - first);
    }
    if (leafPiece.length === 0) {
      throw new Error('physics: the collision pieces of a body leave it without any shape');
    }
    const result = compound.Create();
    if (result.HasError()) {
      throw new Error(`physics: Jolt rejected the collision shape: ${result.GetError().c_str()}`);
    }
    const shape = result.Get();
    shape.AddRef();
    const com = shape.GetCenterOfMass();
    const joltCom: Vec3 = [com.GetX() / scale, com.GetY() / scale, com.GetZ() / scale];
    const bounds = shape.GetLocalBounds();
    const lo = bounds.mMin;
    const loV: Vec3 = [lo.GetX() / scale, lo.GetY() / scale, lo.GetZ() / scale];
    const hi = bounds.mMax;
    const hiV: Vec3 = [hi.GetX() / scale, hi.GetY() / scale, hi.GetZ() / scale];
    const boundingRadius = Math.hypot(
      Math.max(Math.abs(loV[0]), Math.abs(hiV[0])),
      Math.max(Math.abs(loV[1]), Math.abs(hiV[1])),
      Math.max(Math.abs(loV[2]), Math.abs(hiV[2])),
    );
    // How the engine numbers the sub-shapes: the index among the children of the compound in
    // the low bits, and above them the index inside a child that is a compound itself. A
    // compound of one child is replaced by that child and takes no bits.
    const bitsFor = (count: number): number => (count <= 1 ? 0 : 32 - Math.clz32(count - 1));
    const topBits = bitsFor(topFirstLeaf.length);
    const topRound: (RoundSurface | null)[] = [];
    const innerMask: number[] = [];
    for (let top = 0; top < topFirstLeaf.length; top++) {
      const count = topLeafCount[top] as number;
      const inner = bitsFor(count);
      innerMask.push(inner === 0 ? 0 : 2 ** inner - 1);
      topRound.push(count === 1 ? (leafRound[topFirstLeaf[top] as number] ?? null) : null);
    }
    // A sphere about every child of the compound: about the mean of its leaves' centres.
    const leafSphere = Float64Array.from(leafSpheres);
    const topSphere = new Float64Array(4 * topFirstLeaf.length);
    for (let top = 0; top < topFirstLeaf.length; top++) {
      const first = topFirstLeaf[top] as number;
      const count = topLeafCount[top] as number;
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (let k = first; k < first + count; k++) {
        cx += leafSphere[4 * k] as number;
        cy += leafSphere[4 * k + 1] as number;
        cz += leafSphere[4 * k + 2] as number;
      }
      cx /= count;
      cy /= count;
      cz /= count;
      let radius = 0;
      for (let k = first; k < first + count; k++) {
        radius = Math.max(
          radius,
          Math.hypot(
            (leafSphere[4 * k] as number) - cx,
            (leafSphere[4 * k + 1] as number) - cy,
            (leafSphere[4 * k + 2] as number) - cz,
          ) + (leafSphere[4 * k + 3] as number),
        );
      }
      topSphere.set([cx, cy, cz, radius], 4 * top);
    }
    return {
      shape,
      joltCom,
      leafPiece,
      leafRound,
      leafSphere,
      topSphere,
      leafCapsule: Float64Array.from(leafCapsules),
      leafJoined: Uint8Array.from(leafJoined),
      leafFaces,
      subShapeMask: topBits === 0 ? 0 : 2 ** topBits - 1,
      subShapeBits: topBits,
      topFirstLeaf: Int32Array.from(topFirstLeaf),
      topInnerMask: Uint32Array.from(innerMask),
      topRound,
      boundingRadius,
      fallbacks,
    };
  } finally {
    // Releasing the settings frees them and every sub-shape settings object they hold.
    compound.Release();
    for (const [wrapperClass, object] of spent) forgetJoltWrapper(jolt, wrapperClass, object);
    jolt.destroy(vec);
    jolt.destroy(rot);
  }
}

/**
 * Index, in the leaf tables of a built shape, of the leaf a Jolt sub-shape id names (see the
 * end of {@link buildShape} for the numbering).
 */
export function leafOfSubShape(built: BuiltShape, id: number): number {
  const top = id & built.subShapeMask;
  const inner = built.topInnerMask[top] as number;
  const first = built.topFirstLeaf[top] as number;
  return inner === 0 ? first : first + ((id >>> built.subShapeBits) & inner);
}

/**
 * Drops the reference {@link buildShape} took on the shape, and the shape's wrapper object from
 * the bindings of `jolt` (the module instance it was built in).
 */
export function releaseBuiltShape(jolt: JoltModule, built: BuiltShape): void {
  built.shape.Release();
  forgetJoltWrapper(jolt, jolt.Shape, built.shape);
}

/** Number of shapes without a body that a {@link ShapeCache} keeps for reuse by queries. */
export const SHAPE_CACHE_IDLE_LIMIT = 64;

interface CacheEntry {
  readonly built: BuiltShape;
  /** Number of bodies using the shape. */
  users: number;
  /** Value of the cache clock when the entry was last asked for. */
  lastUse: number;
}

/**
 * The Jolt shapes of one world, keyed by the identity of the pieces array they were built from.
 *
 * Bodies of the same item type are added with the same pieces array and then share one Jolt
 * shape, and a probe shape handed to `penetration` or `sweep` again and again is built once.
 * Callers must therefore treat a pieces array as immutable once it has been handed over (the
 * contract types are read-only). Shapes that no body uses are kept up to
 * {@link SHAPE_CACHE_IDLE_LIMIT}; beyond that the least recently used ones are freed, so a caller
 * that passes a fresh array every time cannot exhaust the fixed WebAssembly heap.
 */
export class ShapeCache {
  private readonly entries = new Map<readonly CollisionPiece[], CacheEntry>();
  private readonly solids = new WeakMap<readonly CollisionPiece[], readonly CollisionSolid[]>();
  private clock = 0;
  private idle = 0;
  /** Number of shapes freed so far (a measure of how many dead wrapper objects there are). */
  freed = 0;

  constructor(
    private readonly jolt: JoltModule,
    private readonly settings: JoltWorldSettings,
    private readonly idleLimit: number = SHAPE_CACHE_IDLE_LIMIT,
  ) {}

  private entry(pieces: readonly CollisionPiece[]): CacheEntry {
    let found = this.entries.get(pieces);
    if (found === undefined) {
      found = { built: buildShape(this.jolt, pieces, this.settings), users: 0, lastUse: 0 };
      this.entries.set(pieces, found);
      this.idle++;
    }
    found.lastUse = ++this.clock;
    return found;
  }

  private trim(): void {
    while (this.idle > this.idleLimit) {
      let oldestKey: readonly CollisionPiece[] | undefined;
      let oldest: CacheEntry | undefined;
      for (const [key, candidate] of this.entries) {
        if (candidate.users === 0 && (oldest === undefined || candidate.lastUse < oldest.lastUse)) {
          oldest = candidate;
          oldestKey = key;
        }
      }
      if (oldest === undefined || oldestKey === undefined) return;
      releaseBuiltShape(this.jolt, oldest.built);
      this.entries.delete(oldestKey);
      this.idle--;
      this.freed++;
    }
  }

  /**
   * The shape of `pieces` for a query; valid until the next call into the cache. Round rolling
   * surfaces are left out of it: a query asks about the solid, and theirs spans the cavity.
   */
  probe(pieces: readonly CollisionPiece[]): BuiltShape {
    let solids: readonly CollisionPiece[] = pieces;
    if (pieces.some((piece) => piece.kind === 'round')) {
      // One stripped array per pieces array, so that the stripped shape is cached like any other.
      let stripped = this.solids.get(pieces);
      if (stripped === undefined) {
        stripped = collisionSolids(pieces);
        this.solids.set(pieces, stripped);
      }
      solids = stripped;
    }
    const found = this.entry(solids);
    // Trimming never frees the entry just touched: it has the newest clock value.
    this.trim();
    return found.built;
  }

  /** The shape of `pieces` for a body; pair every call with one {@link ShapeCache.release}. */
  acquire(pieces: readonly CollisionPiece[]): BuiltShape {
    const found = this.entry(pieces);
    if (found.users === 0) this.idle--;
    found.users++;
    return found.built;
  }

  /** Gives back a shape obtained with {@link ShapeCache.acquire}. */
  release(pieces: readonly CollisionPiece[]): void {
    const found = this.entries.get(pieces);
    if (found === undefined || found.users === 0) {
      throw new Error('physics: shape released more often than it was acquired');
    }
    found.users--;
    if (found.users === 0) {
      this.idle++;
      this.trim();
    }
  }

  /** Number of shapes held (for tests and diagnostics). */
  get size(): number {
    return this.entries.size;
  }

  /** Frees every shape. Bodies using them must have been destroyed first. */
  dispose(): void {
    for (const found of this.entries.values()) releaseBuiltShape(this.jolt, found.built);
    this.entries.clear();
    this.idle = 0;
  }
}
