// How collision pieces are split into engine sub-shapes, and the engine hazards the split and
// the unit of length are there to avoid.
import type { Pose, Vec3 } from '@spotless/core';
import { quatFromAxisAngle, quatInverseRotate, quatRotate, v3Sub } from '@spotless/core';
import type {
  CollisionBox,
  CollisionCapsule,
  CollisionHull,
  CollisionPiece,
  MassProperties,
} from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { chordSag } from './convex.ts';
import { acquireJoltModule, idleJoltModuleCount } from './jolt-module.ts';
import { JOLT_SETTINGS } from './settings.ts';
import type { Leaf } from './shapes.ts';
import {
  MIN_CAPSULE_LENGTH_UNITS,
  ShapeCache,
  capsuleLeafCount,
  groupLeaves,
  ownFrameOf,
  planLeaves,
  principalFrameOf,
} from './shapes.ts';
import { makeBowl, makeKnife, makePlate, makeRack, sorPieces } from './test-shapes.ts';
import { AT_ORIGIN, NO_MASS, useWorlds } from './test-world.ts';

const DEG = Math.PI / 180;
const at = (x: number, y: number, z: number): Pose => ({ p: [x, y, z], q: [0, 0, 0, 1] });
const SURFACE = { material: 'steel' };
const count = (leaves: readonly { leaf: Leaf }[], kind: Leaf['kind']): number =>
  leaves.filter((l) => l.leaf.kind === kind).length;

/** A ring of `n` flat wall sectors of a cylinder of radius `r` and height `h`, `t` thick. */
function cylinderWall(n: number, r: number, h: number, t: number): CollisionHull[] {
  return sorPieces(
    [
      { r, z: 0, t },
      { r, z: h, t },
    ],
    n,
    'wall',
  );
}

const newWorld = useWorlds();

describe('planLeaves', () => {
  it('gives a flat ring one prism per sector and capsules on its two free rims only', () => {
    // An annulus from r = 50 to 80 mm in 24 sectors, 4 mm thick: the 24 radial edges are shared
    // by coplanar neighbours and need nothing; the inner and outer rims are free.
    const pieces = sorPieces(
      [
        { r: 0.05, z: 0, t: 0.004 },
        { r: 0.08, z: 0, t: 0.004 },
      ],
      24,
      'ring',
    );
    const leaves = planLeaves(pieces, JOLT_SETTINGS);
    expect(count(leaves, 'polytope')).toBe(24);
    expect(count(leaves, 'capsule')).toBe(48);
    for (const { leaf } of leaves) {
      if (leaf.kind !== 'capsule') continue;
      expect(leaf.radius).toBe(0.002);
      // Every capsule lies along a rim: both ends at the same radius, 50 or 80 mm.
      const ra = Math.hypot(leaf.a[0], leaf.a[1]);
      const rb = Math.hypot(leaf.b[0], leaf.b[1]);
      expect(ra).toBeCloseTo(rb, 12);
      expect([0.05, 0.08].some((r) => Math.abs(ra - r) < 1e-12)).toBe(true);
    }
  });

  it('rounds the fold between two wall sectors only where the fold is sharp enough to matter', () => {
    const r = 0.002;
    // Leaving a fold of angle a to the flats costs r (1 - cos(a / 2)): 0.017 mm at 15 degrees
    // (24 sectors), 0.152 mm at 45 degrees (8 sectors). The allowance for a fold between two
    // sectors of a wall is 0.1 mm (that for the edge of a solid is 0.05 mm).
    expect(chordSag(r, (2 * Math.PI) / 24)).toBeLessThan(JOLT_SETTINGS.roundedFoldSag);
    expect(chordSag(r, (2 * Math.PI) / 8)).toBeGreaterThan(JOLT_SETTINGS.roundedFoldSag);
    expect(JOLT_SETTINGS.roundedFoldSag).toBeGreaterThan(JOLT_SETTINGS.roundedEdgeSag);
    // Top and bottom rims always (2 n); the n vertical folds only for the coarse ring.
    const fine = planLeaves(cylinderWall(24, 0.04, 0.05, 2 * r), JOLT_SETTINGS);
    expect(count(fine, 'polytope')).toBe(24);
    expect(count(fine, 'capsule')).toBe(48);
    const coarse = planLeaves(cylinderWall(8, 0.04, 0.05, 2 * r), JOLT_SETTINGS);
    expect(count(coarse, 'polytope')).toBe(8);
    expect(count(coarse, 'capsule')).toBe(24);
    // A ring of 11 sectors folds by 32.7 degrees, 0.081 mm: rounded under the allowance of a
    // solid's edge, left to the mitred flats under that of a wall's fold.
    const middling = cylinderWall(11, 0.04, 0.05, 2 * r);
    expect(count(planLeaves(middling, JOLT_SETTINGS), 'capsule')).toBe(22);
    expect(
      count(
        planLeaves(middling, { ...JOLT_SETTINGS, roundedFoldSag: JOLT_SETTINGS.roundedEdgeSag }),
        'capsule',
      ),
    ).toBe(33);
    // With no allowance every fold is rounded.
    const exact = planLeaves(cylinderWall(24, 0.04, 0.05, 2 * r), {
      ...JOLT_SETTINGS,
      roundedEdgeSag: 1e-9,
      roundedFoldSag: 1e-9,
    });
    expect(count(exact, 'capsule')).toBe(72);
  });

  it('does not let a thinner neighbour close the edge of a thicker piece', () => {
    // Two coplanar strips sharing an edge, 5 mm and 3 mm thick: the thick strip's rounded edge
    // stands 1 mm proud of the thin strip, so the shared edge keeps a capsule of the larger
    // radius, attributed to the thick piece.
    const strip = (x0: number, x1: number, t: number, part: string): CollisionHull => ({
      kind: 'hull',
      part,
      radius: t / 2,
      points: [
        [x0, 0, 0],
        [x1, 0, 0],
        [x1, 0.03, 0],
        [x0, 0.03, 0],
      ],
    });
    const pieces = [strip(0, 0.02, 0.003, 'thin'), strip(0.02, 0.04, 0.005, 'thick')];
    const leaves = planLeaves(pieces, JOLT_SETTINGS);
    const shared = leaves.filter(
      (l) =>
        l.leaf.kind === 'capsule' &&
        Math.abs(l.leaf.a[0] - 0.02) < 1e-12 &&
        Math.abs(l.leaf.b[0] - 0.02) < 1e-12,
    );
    expect(shared).toHaveLength(1);
    expect(shared[0]?.leaf.kind === 'capsule' && shared[0].leaf.radius).toBe(0.0025);
    expect(pieces[shared[0]?.piece ?? -1]?.part).toBe('thick');
    // 2 prisms, 3 free edges each and the shared one.
    expect(leaves).toHaveLength(2 + 3 + 3 + 1);
    // Equal thickness: the shared edge is closed and gets nothing.
    const even = planLeaves(
      [strip(0, 0.02, 0.005, 'a'), strip(0.02, 0.04, 0.005, 'b')],
      JOLT_SETTINGS,
    );
    expect(even).toHaveLength(2 + 3 + 3);
  });

  it('keeps sharp pieces whole and splits a rounded box into its flats and twelve edges', () => {
    const sharp: CollisionBox = {
      kind: 'box',
      part: 'wall',
      halfExtents: [0.02, 0.001, 0.06],
      radius: 0,
      pose: AT_ORIGIN,
    };
    expect(planLeaves([sharp], JOLT_SETTINGS).map((l) => l.leaf.kind)).toEqual(['box']);
    const rounded: CollisionBox = { ...sharp, halfExtents: [0.02, 0.004, 0.06], radius: 0.001 };
    const leaves = planLeaves([rounded], JOLT_SETTINGS);
    // 0.29 r = 0.29 mm of sag at a right-angled edge: every edge needs its capsule.
    expect(count(leaves, 'polytope')).toBe(1);
    expect(count(leaves, 'capsule')).toBe(12);
    const hull = leaves.find((l) => l.leaf.kind === 'polytope')?.leaf;
    // The flats are at the outer size: 21 x 5 x 61 mm half extents.
    if (hull?.kind === 'polytope') {
      for (let axis = 0; axis < 3; axis++) {
        const reach = Math.max(...hull.points.map((p) => Math.abs(p[axis] as number)));
        expect(reach).toBeCloseTo(([0.021, 0.005, 0.061] as const)[axis] as number, 12);
      }
    }
    // A radius small enough is left to the flats: 0.29 x 0.1 mm = 0.03 mm.
    expect(count(planLeaves([{ ...rounded, radius: 0.0001 }], JOLT_SETTINGS), 'capsule')).toBe(0);
  });

  it('builds the shapes of the bake-off with the expected number of sub-shapes', () => {
    // Plate, 36 sectors: 4 rings of 36 flat pieces; capsules on the rim, on both edges of the
    // foot ring, and where the 5 mm cavetto meets the thinner lip. The 31 degree fold between
    // well and cavetto (0.091 mm of sag at a half thickness of 2.5 mm) is within the allowance
    // of a wall's fold and is mitred; under the allowance of a solid's edge it had a capsule
    // per sector too.
    const plate = planLeaves(makePlate(36).pieces, JOLT_SETTINGS);
    expect(count(plate, 'polytope')).toBe(144);
    expect(count(plate, 'capsule')).toBe(4 * 36);
    expect(
      count(
        planLeaves(makePlate(36).pieces, {
          ...JOLT_SETTINGS,
          roundedFoldSag: JOLT_SETTINGS.roundedEdgeSag,
        }),
        'capsule',
      ),
    ).toBe(5 * 36);
    // The knife: a rounded handle and two blade hulls with a 0.2 mm radius.
    const knife = planLeaves(makeKnife().pieces, JOLT_SETTINGS);
    expect(count(knife, 'polytope')).toBe(3);
    // The result depends on the pieces alone.
    expect(planLeaves(makeBowl(16, 4).pieces, JOLT_SETTINGS)).toEqual(
      planLeaves(makeBowl(16, 4).pieces, JOLT_SETTINGS),
    );
  });
});

describe('the seams between wall sectors', () => {
  // A cylinder wall of 16 flat sectors, 78 mm across and 4 mm thick: the outer face of each
  // sector is a flat at r cos(pi / 16) + t / 2, and two neighbours fold by 22.5 degrees.
  const n = 16;
  const r = 0.039;
  const t = 0.004;
  const wall = cylinderWall(n, r, 0.08, t);

  it('mitres the prisms of neighbouring sectors: their outer corners coincide on the bisecting plane', () => {
    const leaves = planLeaves(wall, JOLT_SETTINGS);
    // No capsule along the folds (their rounding would stand 0.04 mm proud of the flats).
    expect(count(leaves, 'polytope')).toBe(n);
    const outer = r + t / 2 / Math.cos(Math.PI / n);
    const inner = r - t / 2 / Math.cos(Math.PI / n);
    for (const { leaf } of leaves) {
      if (leaf.kind !== 'polytope') continue;
      expect(leaf.points).toHaveLength(8);
      for (const p of leaf.points) {
        // Every corner lies on the radial plane of a sector boundary, at the mitre distance:
        // a square-ended prism would have its outer corners at hypot(r cos + t / 2, r sin),
        // 0.39 mm short of this, and leave a groove 0.78 mm wide between two sectors.
        const rho = Math.hypot(p[0], p[1]);
        expect(Math.min(Math.abs(rho - outer), Math.abs(rho - inner))).toBeLessThan(1e-9);
        const sector = (Math.atan2(p[1], p[0]) * n) / (2 * Math.PI);
        expect(Math.abs(sector - Math.round(sector))).toBeLessThan(1e-9);
      }
    }
    // The mitre stands proud of the true rounded edge by r (1 / cos - 1) of the half
    // thickness: 0.039 mm here, inside the sag tolerance.
    expect(outer - (r + t / 2)).toBeLessThan(JOLT_SETTINGS.roundedEdgeSag);
    expect(outer - (r + t / 2)).toBeGreaterThan(0);
  });

  it.each([0.00015, 0.0005, 0.0021])(
    'stops a probe of radius %d m at the facets, wherever around the wall it comes in',
    async (probeRadius) => {
      // A small sphere swept radially inwards at 360 angles: a knife edge (0.15 mm), a tine tip
      // (0.5 mm), a rack wire (2.1 mm). The exact outer surface is the cylinder of radius
      // r + t / 2; the facets are inside it by at most the chord sag r (1 - cos(pi / 16)) =
      // 0.75 mm. Into the old grooves the knife-edge probe went 1.7 mm.
      const world = await newWorld();
      world.addBody('wall', wall, NO_MASS, SURFACE, AT_ORIGIN, 'static');
      const probe: CollisionCapsule[] = [
        { kind: 'capsule', part: 'probe', a: [0, 0, 0], b: [0, 0, 0], radius: probeRadius },
      ];
      const sag = r * (1 - Math.cos(Math.PI / n));
      let deepest = -Infinity;
      let shallowest = Infinity;
      for (let i = 0; i < 360; i++) {
        const phi = (2 * Math.PI * i) / 360 + 0.0007;
        const from = at(0.2 * Math.cos(phi), 0.2 * Math.sin(phi), 0.04);
        const hit = world.sweep(probe, from, at(0, 0, 0.04));
        expect(hit.hit).toBe(true);
        // Where the probe's surface is when it stops, measured inwards from the true surface.
        const depth = r + t / 2 - (0.2 * (1 - hit.fraction) - probeRadius);
        deepest = Math.max(deepest, depth);
        shallowest = Math.min(shallowest, depth);
      }
      expect(deepest).toBeLessThan(sag + 0.02e-3);
      expect(deepest).toBeGreaterThan(0.9 * sag);
      // Nowhere proud of the true surface by more than the mitre.
      expect(shallowest).toBeGreaterThan(-JOLT_SETTINGS.roundedEdgeSag);
    },
  );
});

describe('engine hazards', () => {
  const mass: MassProperties = {
    mass: 0.02,
    com: [0, 0, 0.004],
    inertia: [2e-7, 0, 0, 0, 2e-7, 0, 0, 0, 1e-7],
  };
  // A peg 2 mm long and 3 mm thick standing on end: Jolt's capsule code treats any capsule
  // shorter than its 0.02-unit slop as lying side-on, whatever hits it.
  const peg: CollisionCapsule = {
    kind: 'capsule',
    part: 'peg',
    a: [0, 0, 0.003],
    b: [0, 0, 0.005],
    radius: 0.0015,
  };
  const slab: CollisionPiece[] = [
    { kind: 'box', part: 'floor', halfExtents: [0.1, 0.1, 0.01], radius: 0, pose: at(0, 0, -0.01) },
  ];

  it('a short capsule standing on end rests quietly in centimetre units', async () => {
    const world = await newWorld();
    world.addBody('floor', slab, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('peg', [peg], mass, SURFACE, at(0, 0, -0.0014), 'dynamic');
    let fastest = 0;
    for (let i = 0; i < 240; i++) {
      world.step(1);
      const v = world.getVelocity('peg').linear;
      fastest = Math.max(fastest, Math.hypot(v[0], v[1], v[2]));
    }
    // It was released 0.1 mm above the floor: nothing in this scene exceeds a few cm/s.
    expect(fastest).toBeLessThan(0.05);
    expect(world.getPose('peg').p[2]).toBeGreaterThan(-0.0016);
  });

  it('a bowl with a capsule on every edge, 2 mm ones standing on end among them, rests quietly', async () => {
    // The scene that showed the hazard: with the engine in metres and every edge given its
    // capsule, the 2 mm vertical edges of the foot ring made Jolt build contact points 10^9 km
    // away and the bowl left the floor at 3 m/s in the first step (500 m/s with a second bowl
    // in it). No capsule the wrapper creates can be met end-on with a supporting face now: one
    // is returned only when |cos| of the angle between axis and contact normal is below
    // 0.02 / length, which is at most 0.8 for the shortest capsule created.
    const world = await newWorld({ settings: { roundedEdgeSag: 1e-9 } });
    const bowl = makeBowl(24, 5);
    world.addBody('floor', slab, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'bowl',
      bowl.pieces,
      bowl.mass,
      SURFACE,
      { p: [0, 0, 0.0005], q: quatFromAxisAngle([0, 0, 1], 0.1) },
      'dynamic',
    );
    let fastest = 0;
    for (let i = 0; i < 240; i++) {
      world.step(1);
      const v = world.getVelocity('bowl').linear;
      fastest = Math.max(fastest, Math.hypot(v[0], v[1], v[2]));
    }
    // Released 0.5 mm above the floor it lands at 0.1 m/s.
    expect(fastest).toBeLessThan(0.15);
    expect(Math.abs(world.getPose('bowl').p[2])).toBeLessThan(1.5e-4);
    expect(world.isActive('bowl')).toBe(false);
  });

  it('gives the engine two spheres for a capsule shorter than the slop', async () => {
    // 0.2 mm long in centimetre units is 0.02 units: below the limit.
    const stub: CollisionCapsule = {
      kind: 'capsule',
      part: 'stub',
      a: [0, 0, 0.003],
      b: [0, 0, 0.0032],
      radius: 0.0015,
    };
    expect(0.0002 * JOLT_SETTINGS.engineLengthScale).toBeLessThan(MIN_CAPSULE_LENGTH_UNITS);
    const world = await newWorld();
    world.addBody('floor', slab, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('stub', [stub], mass, SURFACE, at(0, 0, -0.0014), 'dynamic');
    world.step(240);
    // It rests on the floor on its lower sphere: origin 1.5 mm below the sphere centre at 3 mm.
    expect(world.getPose('stub').p[2]).toBeCloseTo(-0.0015, 4);
    // And the probe shape built from it is the capsule to within the scallop between the two
    // spheres (nothing, here): 1 mm deep when lowered 1 mm into the floor.
    expect(world.penetration([stub], at(0, 0, -0.0025), ['stub']).depth).toBeCloseTo(0.001, 6);
  });

  it('builds a knife blade that Jolt cannot hull as faceted, from its plain envelope', async () => {
    // The blade is a wedge 0.1 to 1.6 mm thick with a 0.2 mm radius; Jolt's hull builder loses
    // a vertex of its faceted form. The fallback (the wedge grown by the radius, sharp-cornered)
    // is exact on the flats: a ball pressed 0.3 mm into the middle of the blade's side.
    const knife = makeKnife();
    const world = await newWorld({ gravity: [0, 0, 0] });
    world.addBody('knife', knife.pieces, knife.mass, SURFACE, AT_ORIGIN, 'dynamic');
    const ball: CollisionCapsule = {
      kind: 'capsule',
      part: 'p',
      a: [0, 0, 0],
      b: [0, 0, 0],
      radius: 0.002,
    };
    // Mid-blade (x = 0, y = 35 mm): the core is 0.425 mm thick each side of z = 4 mm there, so
    // the surface is at z = 4 + 0.425 + 0.2 (radius) = 4.625 mm; the side slopes 2.2 degrees.
    const surface = 0.004 + 0.000425 + 0.0002 / Math.cos(2.19 * DEG);
    const depth = world.penetration([ball], at(0, 0.035, surface + 0.002 - 0.0003)).depth;
    expect(depth).toBeCloseTo(0.0003, 5);
  });
});

describe('ShapeCache', () => {
  it('shares one shape between bodies added with the same pieces and frees idle shapes', async () => {
    const jolt = await acquireJoltModule();
    // Shapes need an engine instance (it registers the shape types).
    const pairFilter = new jolt.ObjectLayerPairFilterTable(1);
    const layers = new jolt.BroadPhaseLayerInterfaceTable(1, 1);
    const layer = new jolt.BroadPhaseLayer(0);
    layers.MapObjectToBroadPhaseLayer(0, layer);
    const creation = new jolt.JoltSettings();
    creation.mObjectLayerPairFilter = pairFilter;
    creation.mBroadPhaseLayerInterface = layers;
    creation.mObjectVsBroadPhaseLayerFilter = new jolt.ObjectVsBroadPhaseLayerFilterTable(
      layers,
      1,
      pairFilter,
      1,
    );
    const engine = new jolt.JoltInterface(creation);
    const cache = new ShapeCache(jolt, JOLT_SETTINGS, 2);
    const ballOf = (r: number): CollisionPiece[] => [
      { kind: 'capsule', part: 'b', a: [0, 0, 0], b: [0, 0, 0], radius: r },
    ];
    const pieces = ballOf(0.01);
    const first = cache.acquire(pieces);
    expect(cache.acquire(pieces)).toBe(first);
    expect(cache.probe(pieces)).toBe(first);
    expect(cache.size).toBe(1);
    // Another array with the same content is another shape.
    expect(cache.probe(ballOf(0.01))).not.toBe(first);
    // Idle shapes beyond the limit of two are freed, least recently used first; the shape two
    // bodies use is not idle.
    for (const r of [0.011, 0.012, 0.013]) cache.probe(ballOf(r));
    expect(cache.size).toBe(3);
    cache.release(pieces);
    cache.release(pieces);
    expect(cache.size).toBe(2);
    expect(() => cache.release(pieces)).toThrow(/released more often/);
    cache.dispose();
    jolt.destroy(engine);
    jolt.destroy(creation);
    jolt.destroy(layer);
    expect(idleJoltModuleCount()).toBeGreaterThanOrEqual(0);
  });

  it('builds each item type once however many bodies use it', async () => {
    const world = await newWorld();
    const plate = makePlate(24);
    const free = world.stats().freeMemory;
    world.addBody('plate_0', plate.pieces, plate.mass, SURFACE, at(0, 0, 0), 'dynamic');
    world.step(0);
    const one = free - world.stats().freeMemory;
    for (let i = 1; i < 12; i++) {
      world.addBody(`plate_${i}`, plate.pieces, plate.mass, SURFACE, at(0.3 * i, 0, 0), 'dynamic');
    }
    world.step(0);
    const twelve = free - world.stats().freeMemory;
    // Eleven more bodies cost far less than eleven more shapes would.
    expect(one).toBeGreaterThan(50_000);
    expect(twelve).toBeLessThan(1.5 * one);
  });
});

describe('what goes to the engine together', () => {
  it('cuts a capsule into equal lengths of at most 40 mm, sixteen at most', () => {
    expect(capsuleLeafCount(0)).toBe(1);
    expect(capsuleLeafCount(0.04)).toBe(1);
    expect(capsuleLeafCount(0.0401)).toBe(2);
    // A rail of half a metre: 12.5 lengths of 40 mm, so 13 of 38.5 mm.
    expect(capsuleLeafCount(0.5)).toBe(13);
    // The edge of the 100 m slab that stands for a kitchen floor: 16, not 2,500.
    expect(capsuleLeafCount(100)).toBe(16);
  });

  it('finds the frame in which a slanted slab has its smallest box, and uses it only then', () => {
    // A slab of 100 x 20 x 4 mm about (0.2, 0.1, 0.05), turned 30 degrees about z.
    const centre: Vec3 = [0.2, 0.1, 0.05];
    const half: Vec3 = [0.05, 0.01, 0.002];
    const corners = (turn: number): Vec3[] => {
      const q = quatFromAxisAngle([0, 0, 1], turn);
      const out: Vec3[] = [];
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const p = quatRotate(q, [sx * half[0], sy * half[1], sz * half[2]]);
            out.push([centre[0] + p[0], centre[1] + p[1], centre[2] + p[2]]);
          }
        }
      }
      return out;
    };
    const slanted = corners(30 * DEG);
    const frame = principalFrameOf(slanted);
    expect(frame).not.toBeNull();
    if (frame === null) return;
    for (let i = 0; i < 3; i++) expect(frame.p[i]).toBeCloseTo(centre[i] as number, 12);
    // Seen from that frame the corners span the slab itself: 4, 20 and 100 mm.
    const spans = [0, 1, 2].map((axis) => {
      const along = slanted.map(
        (p) => quatInverseRotate(frame.q, v3Sub(p, frame.p))[axis] as number,
      );
      return Math.max(...along) - Math.min(...along);
    });
    spans.sort((a, b) => a - b);
    expect(spans[0]).toBeCloseTo(0.004, 9);
    expect(spans[1]).toBeCloseTo(0.02, 9);
    expect(spans[2]).toBeCloseTo(0.1, 9);
    // In the item frame its box is (100 cos 30 + 20 sin 30) x (100 sin 30 + 20 cos 30) x 4 mm,
    // 3.25 times the slab: the frame of its own is used. Lying square, it is not.
    expect(ownFrameOf(slanted)).not.toBeNull();
    expect(ownFrameOf(corners(0))).toBeNull();
    // Too few points to span anything.
    expect(principalFrameOf(slanted.slice(0, 3))).toBeNull();
  });

  it('groups each rounded piece with its own edge capsules, the solid first, and leaves wires alone', () => {
    const kindsOf = (pieces: readonly CollisionPiece[]): { groups: string[]; lone: string[] } => {
      const planned = planLeaves(pieces, JOLT_SETTINGS);
      const seen: number[] = [];
      const groups: string[] = [];
      const lone: string[] = [];
      for (const entry of groupLeaves(planned)) {
        if (typeof entry === 'number') {
          seen.push(entry);
          lone.push((planned[entry] as { leaf: Leaf }).leaf.kind);
          continue;
        }
        // Members in ascending order, all of one collision piece.
        expect([...entry.members].sort((a, b) => a - b)).toEqual([...entry.members]);
        expect(
          new Set(entry.members.map((m) => (planned[m] as { piece: number }).piece)).size,
        ).toBe(1);
        seen.push(...entry.members);
        groups.push(entry.members.map((m) => (planned[m] as { leaf: Leaf }).leaf.kind[0]).join(''));
      }
      // Every leaf is in the compound exactly once.
      expect(seen.sort((a, b) => a - b)).toEqual(planned.map((_, i) => i));
      return { groups, lone };
    };
    // A dinner knife: three rounded pieces, each a solid with the capsules of its edges.
    const knife = kindsOf(makeKnife().pieces);
    expect(knife.lone).toEqual([]);
    expect(knife.groups.length).toBe(3);
    for (const group of knife.groups) expect(group).toMatch(/^pc+$/);
    // A plate of 36 sectors, 144 pieces: every group is one solid, with the rim capsules it
    // has (none, one or two); the eight solids that lie square in the item frame stay alone.
    const plate = kindsOf(makePlate(36).pieces);
    expect(plate.groups.length + plate.lone.length).toBe(144);
    for (const group of plate.groups) expect(group).toMatch(/^pc{0,2}$/);
    expect(plate.lone.every((kind) => kind === 'polytope')).toBe(true);
    expect(plate.lone.length).toBe(8);
    // A rack is wires only: nothing to group (their cutting into lengths is the engine's
    // business, see `capsuleLeafCount`).
    const rack = kindsOf(makeRack());
    expect(rack.groups).toEqual([]);
    expect(rack.lone.every((kind) => kind === 'capsule')).toBe(true);
  });

  it('still names the piece and the part of every contact through the groups', async () => {
    // A body of three pieces standing on a floor like a tripod: a ball and a rounded block (a
    // solid with twelve edge capsules) side by side at x = -60 mm, and a bar of 200 mm (cut
    // into five lengths) along y at x = +60 mm. Each contact must name the piece that is
    // where it is.
    const world = await newWorld();
    world.addBody(
      'floor',
      [
        {
          kind: 'box',
          part: 'floor',
          halfExtents: [0.3, 0.3, 0.01],
          radius: 0,
          pose: at(0, 0, -0.01),
        },
      ],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    const r = 0.01;
    const pieces: CollisionPiece[] = [
      { kind: 'capsule', part: 'ball', a: [-0.06, -0.05, r], b: [-0.06, -0.05, r], radius: r },
      { kind: 'capsule', part: 'bar', a: [0.06, -0.1, r], b: [0.06, 0.1, r], radius: r },
      // (A rounded box is its half extents and its radius: 8 + 2 mm up to its centre.)
      {
        kind: 'box',
        part: 'block',
        halfExtents: [0.02, 0.02, 0.008],
        radius: 0.002,
        pose: at(-0.06, 0.05, r),
      },
    ];
    const mass: MassProperties = {
      mass: 0.3,
      com: [0, 0, r],
      inertia: [1e-3, 0, 0, 0, 1e-3, 0, 0, 0, 1e-3],
    };
    world.addBody('thing', pieces, mass, SURFACE, at(0, 0, 0.003), 'dynamic');
    world.step(240);
    const points = world.contactPoints({ bodies: ['thing'] }).filter((point) => point.touching);
    const parts = new Set<string>();
    for (const point of points) {
      expect(point.a).toBe('floor');
      expect(point.partA).toBe('floor');
      parts.add(point.partB);
      expect(pieces[point.pieceB]?.part).toBe(point.partB);
      const [x, y] = point.positionB;
      if (point.partB === 'ball') {
        expect(Math.hypot(x + 0.06, y + 0.05)).toBeLessThan(0.002);
      } else if (point.partB === 'bar') {
        expect(Math.abs(x - 0.06)).toBeLessThan(0.002);
        expect(Math.abs(y)).toBeLessThan(0.102);
      } else {
        expect(Math.abs(x + 0.06)).toBeLessThan(0.024);
        expect(Math.abs(y - 0.05)).toBeLessThan(0.024);
      }
    }
    expect([...parts].sort()).toEqual(['ball', 'bar', 'block']);
  });
});
