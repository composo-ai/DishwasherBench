/**
 * Basins: the water an upward-facing cavity of a body of revolution holds before it spills
 * (docs/design/sim-core.md section 3.7 item 5, the analytic branch; scene brief item 4: "the
 * tilted-rim-plane construction from the profile is enough").
 *
 * **Which cavities.** Within one item, the shells of revolution that share an axis (unstretched,
 * full turn) and the capsules on that axis (a stem, a knob) are taken together: the boundary of
 * their union in the meridian plane is walked from each point where it meets the axis (a pole)
 * outwards. Along that walk the surface first reaches a floor and then climbs to a crest, the
 * first height maximum from which it falls again: the rim of a mug seen from its inner pole,
 * the foot ring of an inverted mug seen from the pole of its base. The stretch from the pole to
 * the crest is the cavity. Because the walk runs over the union, a recess whose floor is one
 * part and whose wall is another (base and foot ring; bowl and stem) is one cavity.
 *
 * **How much it holds.** In the settled pose the water surface is the horizontal plane through
 * the point it spills over: on the low side of the tilted cavity, the highest point of the
 * meridian between the floor and the crest (the lowest point of the crest circle, or of the
 * rounded rim just inside it). With the up direction u = (u_h, u_z) in the frame of
 * the axis, the height of a surface point is H = u_h r cos(phi) + u_z z, so every meridian
 * sample is under water on an interval of azimuth known in closed form, and the volume is the
 * surface integral of (level - H) (u . n) over the wetted surface (divergence theorem), done in
 * closed form in azimuth and by the midpoint rule along the meridian
 * (`scene.basinSampleStep`). The same integral at 64 levels gives the level table.
 *
 * A cavity one of whose walls is perforated (a colander, a sieve) holds nothing.
 *
 * Not found here: cavities of shapes that are not bodies of revolution (box shells: containers,
 * trays, oven dishes, tins), of stretched shells (oval platters, spoon bowls) and annular
 * troughs that do not reach the axis. `basins-flood.ts` finds those by filling the terrain of
 * the item, and leaves alone every pool that shares a block with a basin found here. No cavity
 * of a machine part is reported by either. A cavity is assumed to stay one pool up to its
 * crest; at a tilt at which the water would also find a second way out the crest circle still
 * decides. A pool under an overhang is found by neither: a bottle tipped past the horizontal
 * reports no basin although its shoulder holds water (water_bottle_tritan_1l at 100 degrees:
 * 11.7 ml by a flood fill of the kernel's signed distance on 1.5 mm voxels, measured in the
 * review of this module; the same flood fill agrees with the reported basins within 1 % for
 * mugs, glasses, a baby bottle and lids at tilts up to 70 degrees).
 *
 * Units: SI. Frames: the axis frame of a group for the analysis; tub frame for what is reported.
 */

import type { Vec3 } from '@spotless/core';
import { v3AnyPerpendicular } from '@spotless/core';
import { prepareProfile, profileDistance, type PreparedProfile } from '@spotless/geometry';
import { affinePoint, affineVector } from './affine.ts';
import { PATCH_KIND, type AtlasPatch } from './atlas-core.ts';
import type { PartGeometry, ShapeAtlasBuilt } from './atlas.ts';
import { atlasCellAt } from './locate.ts';
import {
  capsuleRun,
  createMeridianPoint,
  meridianAt,
  MERIDIAN_AXIS_TOLERANCE,
  type MeridianRun,
} from './meridian.ts';
import { BASIN_LEVELS } from './params.ts';
import type { SceneBuild } from './scene-internal.ts';
import { BLOCK_FLAG, SCENE_NONE, type SceneBasin } from './scene-types.ts';

/** A surface sample is buried when it lies deeper than this in another member, metres. */
const BURIED = 1e-7;

/** Largest angle between two samples of an arc of a meridian, radians. */
const ARC_SAMPLE_ANGLE = 0.2;

interface Member {
  readonly part: number;
  /** +1 when the member's own axis points along the group axis, -1 when against it. */
  readonly sign: 1 | -1;
  /** Group-axis coordinate of the member's own origin, metres. */
  readonly offset: number;
  readonly runs: readonly MeridianRun[];
  /** Per run: the patch that carries it, or -1 for a line patch (see `linePatch`). */
  readonly runPatch: readonly number[];
  /** For a thin capsule: its line patch and radius. */
  readonly linePatch: number;
  readonly radius: number;
  /** Signed distance in the meridian plane, in the member's own (r, z). */
  readonly distance: (r: number, z: number) => number;
}

interface Cavity {
  /** +1 when the cavity opens along the group axis, -1 against it. */
  readonly sigma: 1 | -1;
  /** Sample indices from the pole to the crest. */
  readonly chain: Int32Array;
}

interface Group {
  /** A point of the axis and its unit direction, item frame. */
  readonly origin: Vec3;
  readonly axis: Vec3;
  readonly members: readonly Member[];
  // Samples of the union boundary, in group coordinates.
  readonly r: Float64Array;
  readonly z: Float64Array;
  readonly nr: Float64Array;
  readonly nz: Float64Array;
  readonly ds: Float64Array;
  readonly member: Int32Array;
  readonly run: Int32Array;
  /** Arc length of the sample along its run, metres. */
  readonly s: Float64Array;
  readonly cavities: readonly Cavity[];
}

const groupCache = new WeakMap<ShapeAtlasBuilt, Map<string, readonly Group[]>>();

function axisOfPart(atlas: ShapeAtlasBuilt, part: number): { origin: Vec3; axis: Vec3 } | null {
  const g = atlas.partGeometry[part] as PartGeometry;
  const prim = (atlas.shape.parts[part] as { prim: { kind: string } }).prim;
  let frameToItem: AtlasPatch['toItem'] | null = null;
  if (g.kind === 'sor') {
    const sor = prim as { scaleXY?: readonly [number, number] };
    if (
      g.arc !== null ||
      (sor.scaleXY !== undefined && (sor.scaleXY[0] !== 1 || sor.scaleXY[1] !== 1))
    ) {
      return null;
    }
    frameToItem = g.toItem;
  } else if (g.kind === 'line' || g.kind === 'capsule') {
    frameToItem = (atlas.patches[g.place.patch] as AtlasPatch).toItem;
  }
  if (frameToItem === null) return null;
  return {
    origin: affinePoint(frameToItem, 0, 0, 0),
    axis: affineVector(frameToItem, 0, 0, 1),
  };
}

/** The coaxial groups of an atlas with the cavities of each, independent of any pose. */
function groupsOf(atlas: ShapeAtlasBuilt, step: number, minDepth: number): readonly Group[] {
  let perAtlas = groupCache.get(atlas);
  if (perAtlas === undefined) {
    perAtlas = new Map();
    groupCache.set(atlas, perAtlas);
  }
  const key = `${step}|${minDepth}`;
  const cached = perAtlas.get(key);
  if (cached !== undefined) return cached;

  const shape = atlas.shape;
  const taken = new Array<boolean>(shape.parts.length).fill(false);
  const groups: Group[] = [];
  for (let seed = 0; seed < shape.parts.length; seed++) {
    if (taken[seed] === true) continue;
    const seedGeometry = atlas.partGeometry[seed] as PartGeometry;
    if (seedGeometry.kind !== 'sor') continue;
    const seedAxis = axisOfPart(atlas, seed);
    if (seedAxis === null) continue;
    const { origin, axis } = seedAxis;
    const members: Member[] = [];
    for (let part = seed; part < shape.parts.length; part++) {
      if (taken[part] === true) continue;
      const other = axisOfPart(atlas, part);
      if (other === null) continue;
      const along = other.axis[0] * axis[0] + other.axis[1] * axis[1] + other.axis[2] * axis[2];
      if (Math.abs(Math.abs(along) - 1) > 1e-9) continue;
      const rel: Vec3 = [
        other.origin[0] - origin[0],
        other.origin[1] - origin[1],
        other.origin[2] - origin[2],
      ];
      const offset = rel[0] * axis[0] + rel[1] * axis[1] + rel[2] * axis[2];
      if (
        Math.hypot(
          rel[0] - offset * axis[0],
          rel[1] - offset * axis[1],
          rel[2] - offset * axis[2],
        ) > 1e-7
      ) {
        continue;
      }
      const g = atlas.partGeometry[part] as PartGeometry;
      const sign: 1 | -1 = along > 0 ? 1 : -1;
      if (g.kind === 'sor') {
        const profile: PreparedProfile = prepareProfile(
          (shape.parts[part] as { prim: { profile: Parameters<typeof prepareProfile>[0] } }).prim
            .profile,
        );
        members.push({
          part,
          sign,
          offset,
          runs: g.runs.map((entry) => entry.run),
          runPatch: g.runs.map((entry) => entry.place.patch),
          linePatch: -1,
          radius: 0,
          distance: (r, z) => profileDistance(profile, r, z, 0),
        });
      } else if (g.kind === 'line' || g.kind === 'capsule') {
        const patch = atlas.patches[g.place.patch] as AtlasPatch;
        const length = g.kind === 'line' ? patch.length : g.length;
        if (!(length > 0)) continue;
        const radius = patch.radius;
        members.push({
          part,
          sign,
          offset,
          runs: [capsuleRun(radius, length)],
          runPatch: [g.kind === 'line' ? -1 : g.place.patch],
          linePatch: g.kind === 'line' ? g.place.patch : -1,
          radius,
          distance: (r, z) => Math.hypot(r, z - Math.min(length, Math.max(0, z))) - radius,
        });
      } else {
        continue;
      }
      taken[part] = true;
    }

    // Samples of every member's meridian that are not buried in another member.
    const sr: number[] = [];
    const sz: number[] = [];
    const snr: number[] = [];
    const snz: number[] = [];
    const sds: number[] = [];
    const sm: number[] = [];
    const srun: number[] = [];
    const ss: number[] = [];
    /** Neighbours of each sample on the union boundary. */
    const links: number[][] = [];
    const poles: number[] = [];
    const pt = createMeridianPoint();
    const ends: number[] = [];
    members.forEach((member, mi) => {
      member.runs.forEach((run, ri) => {
        let previous = -1;
        let firstOfRun = -1;
        let lastIndex = -1;
        let ordinal = 0;
        let total = 0;
        // Every piece is sampled at the step, an arc at 0.2 rad at the least, so that the top
        // of a rim of any radius is found to half a percent of that radius.
        const counts = run.pieces.map((piece) => {
          const n = Math.max(
            1,
            Math.ceil(piece.length / step),
            piece.arc ? Math.ceil((piece.th1 - piece.th0) / ARC_SAMPLE_ANGLE) : 1,
          );
          total += n;
          return n;
        });
        run.pieces.forEach((piece, pi) => {
          const n = counts[pi] as number;
          const ds = piece.length / n;
          for (let j = 0; j < n; j++, ordinal++) {
            const s = piece.s0 + (j + 0.5) * ds;
            meridianAt(run, s, pt);
            const zg = member.offset + member.sign * pt.z;
            let buried = false;
            for (let other = 0; other < members.length && !buried; other++) {
              if (other === mi) continue;
              const o = members[other] as Member;
              if (o.distance(pt.r, o.sign * (zg - o.offset)) < -BURIED) buried = true;
            }
            if (buried) {
              if (previous >= 0) ends.push(previous);
              previous = -1;
              continue;
            }
            const index = sr.length;
            sr.push(pt.r);
            sz.push(zg);
            snr.push(pt.nr);
            snz.push(member.sign * pt.nz);
            sds.push(ds);
            sm.push(mi);
            srun.push(ri);
            ss.push(s);
            links.push([]);
            if (previous >= 0) {
              (links[previous] as number[]).push(index);
              (links[index] as number[]).push(previous);
            } else if (ordinal > 0) {
              ends.push(index);
            }
            if (firstOfRun < 0 && ordinal === 0) firstOfRun = index;
            if (ordinal === total - 1) lastIndex = index;
            previous = index;
          }
        });
        const firstPiece = run.pieces[0] as { r0: number };
        const lastPiece = run.pieces[run.pieces.length - 1] as { r1: number };
        if (run.periodic) {
          if (firstOfRun >= 0 && lastIndex >= 0 && firstOfRun !== lastIndex) {
            (links[firstOfRun] as number[]).push(lastIndex);
            (links[lastIndex] as number[]).push(firstOfRun);
          } else {
            if (firstOfRun >= 0) ends.push(firstOfRun);
            if (lastIndex >= 0) ends.push(lastIndex);
          }
        } else {
          if (firstOfRun >= 0) {
            if (Math.abs(firstPiece.r0) <= MERIDIAN_AXIS_TOLERANCE) poles.push(firstOfRun);
            else ends.push(firstOfRun);
          }
          if (lastIndex >= 0) {
            if (Math.abs(lastPiece.r1) <= MERIDIAN_AXIS_TOLERANCE) poles.push(lastIndex);
            else ends.push(lastIndex);
          }
        }
      });
    });
    // Where a member's live stretch ends, the boundary goes on along another member.
    for (const end of ends) {
      let best = -1;
      let bestD = 2.5 * step;
      for (let other = 0; other < sr.length; other++) {
        if (sm[other] === sm[end]) continue;
        const d = Math.hypot(
          (sr[other] as number) - (sr[end] as number),
          (sz[other] as number) - (sz[end] as number),
        );
        if (d < bestD) {
          bestD = d;
          best = other;
        }
      }
      if (best >= 0 && !(links[end] as number[]).includes(best)) {
        (links[end] as number[]).push(best);
        (links[best] as number[]).push(end);
      }
    }

    // Walk from every pole outwards to the first crest.
    const cavities: Cavity[] = [];
    for (const pole of poles) {
      const sigma: 1 | -1 = (snz[pole] as number) >= 0 ? 1 : -1;
      const chain: number[] = [pole];
      const visited = new Set<number>([pole]);
      let current = pole;
      let risen = false;
      let floor = sigma * (sz[pole] as number);
      let top = floor;
      let crest = 0;
      let found = false;
      for (;;) {
        // The next sample: an unvisited neighbour, the one of the same run first.
        let next = -1;
        for (const candidate of links[current] as number[]) {
          if (visited.has(candidate)) continue;
          if (next < 0 || (srun[candidate] === srun[current] && sm[candidate] === sm[current])) {
            next = candidate;
          }
        }
        if (next < 0) break;
        visited.add(next);
        chain.push(next);
        current = next;
        const height = sigma * (sz[next] as number);
        if (!risen) {
          // Still on the way down from the pole (a punt): the floor has not been reached.
          if (height < floor) {
            floor = height;
            top = height;
            crest = chain.length - 1;
            continue;
          }
          risen = true;
        }
        if (height > top) {
          top = height;
          crest = chain.length - 1;
        } else if (height < top - Math.max(minDepth, 2 * step)) {
          found = true;
          break;
        }
      }
      let lowest = Number.POSITIVE_INFINITY;
      for (let i = 0; i <= crest; i++)
        lowest = Math.min(lowest, sigma * (sz[chain[i] as number] as number));
      // A cavity bounded by a perforated part holds nothing.
      const porous = chain.some(
        (k, i) =>
          i <= crest &&
          ((shape.parts[(members[sm[k] as number] as Member).part] as { porosity?: number })
            .porosity ?? 0) > 0,
      );
      if (found && !porous && top - lowest > minDepth) {
        cavities.push({ sigma, chain: Int32Array.from(chain.slice(0, crest + 1)) });
      }
    }
    groups.push({
      origin,
      axis,
      members,
      r: Float64Array.from(sr),
      z: Float64Array.from(sz),
      nr: Float64Array.from(snr),
      nz: Float64Array.from(snz),
      ds: Float64Array.from(sds),
      member: Int32Array.from(sm),
      run: Int32Array.from(srun),
      s: Float64Array.from(ss),
      cavities,
    });
  }
  perAtlas.set(key, groups);
  return groups;
}

/**
 * Volume of water in a cavity up to `level` (the height along the up direction, measured from
 * the group origin), m3: the integral of (level - H) (u . n) over the wetted surface.
 */
function volumeAt(group: Group, chain: Int32Array, uh: number, uz: number, level: number): number {
  let volume = 0;
  for (let i = 0; i < chain.length; i++) {
    const k = chain[i] as number;
    const r = group.r[k] as number;
    const a = level - uz * (group.z[k] as number);
    const b = uh * r;
    const c = uh * (group.nr[k] as number);
    const e = uz * (group.nz[k] as number);
    let integral: number;
    if (a >= b) {
      integral = 2 * Math.PI * a * e - Math.PI * b * c;
    } else if (a <= -b) {
      continue;
    } else {
      const phi0 = Math.acos(a / b);
      integral =
        2 * a * e * (Math.PI - phi0) -
        2 * (a * c - b * e) * Math.sin(phi0) -
        b * c * (Math.PI - phi0 - 0.5 * Math.sin(2 * phi0));
    }
    volume += (group.ds[k] as number) * r * integral;
  }
  return volume;
}

/** Finds the basins of every wash item in its pose. Sets the `basin` flag of the wetted blocks. */
export function findBasins(scene: SceneBuild): SceneBasin[] {
  const { params, blocks, centre } = scene;
  const basins: SceneBasin[] = [];
  for (const build of scene.instances) {
    if (build.instance.kind !== 'item') continue;
    const groups = groupsOf(build.atlas, params.basinSampleStep, params.basinMinDepth);
    for (const group of groups) {
      if (group.cavities.length === 0) continue;
      const up = affineVector(build.toItem, 0, 0, 1);
      const uz = up[0] * group.axis[0] + up[1] * group.axis[1] + up[2] * group.axis[2];
      const uh = Math.sqrt(Math.max(0, 1 - uz * uz));
      // Unit vector across the axis towards which height rises fastest.
      let rise: Vec3 = [
        up[0] - uz * group.axis[0],
        up[1] - uz * group.axis[1],
        up[2] - uz * group.axis[2],
      ];
      rise =
        uh > 1e-9 ? [rise[0] / uh, rise[1] / uh, rise[2] / uh] : v3AnyPerpendicular(group.axis);
      const originTub = affinePoint(build.toTub, group.origin[0], group.origin[1], group.origin[2]);
      for (const cavity of group.cavities) {
        if (!(cavity.sigma * uz > 1e-9)) continue;
        const chain = cavity.chain;
        // On the low side of the tilted cavity the height of the meridian is u_z z - u_h r. The
        // water lies about its lowest point and leaves over the highest point between there and
        // the crest: the lowest point of the crest circle, or of the rounded rim just inside it.
        let lowest = Number.POSITIVE_INFINITY;
        let lowestAt = 0;
        for (let i = 0; i < chain.length; i++) {
          const k = chain[i] as number;
          const height = uz * (group.z[k] as number) - uh * (group.r[k] as number);
          if (height < lowest) {
            lowest = height;
            lowestAt = i;
          }
        }
        let spill = Number.NEGATIVE_INFINITY;
        let crest = chain[chain.length - 1] as number;
        for (let i = lowestAt; i < chain.length; i++) {
          const k = chain[i] as number;
          const height = uz * (group.z[k] as number) - uh * (group.r[k] as number);
          if (height > spill) {
            spill = height;
            crest = k;
          }
        }
        if (!(spill - lowest > params.basinMinDepth)) continue;
        const levelTable = new Float32Array(2 * BASIN_LEVELS);
        for (let j = 0; j < BASIN_LEVELS; j++) {
          const depth = ((spill - lowest) * j) / (BASIN_LEVELS - 1);
          levelTable[2 * j] = depth;
          levelTable[2 * j + 1] = Math.max(0, volumeAt(group, chain, uh, uz, lowest + depth));
        }
        const volume = levelTable[2 * BASIN_LEVELS - 1] as number;
        if (!(volume > 0)) continue;

        // The point of the crest circle the water leaves by: its lowest.
        const rc = group.r[crest] as number;
        const zc = group.z[crest] as number;
        const spillItem: Vec3 = [
          group.origin[0] + zc * group.axis[0] - rc * rise[0],
          group.origin[1] + zc * group.axis[1] - rc * rise[1],
          group.origin[2] + zc * group.axis[2] - rc * rise[2],
        ];
        const spillPoint = affinePoint(build.toTub, spillItem[0], spillItem[1], spillItem[2]);
        const spillLevel = originTub[2] + spill;

        // Which stretches of each member's meridian belong to the cavity.
        const inCavity = new Map<number, { s0: number; s1: number }[]>();
        for (let i = 0; i < chain.length; i++) {
          const k = chain[i] as number;
          const key = (group.member[k] as number) * 65536 + (group.run[k] as number);
          const half = 0.5 * (group.ds[k] as number);
          const list = inCavity.get(key) ?? [];
          const last = list[list.length - 1];
          const s = group.s[k] as number;
          if (last !== undefined && Math.abs(s - half - last.s1) < 1e-9) last.s1 = s + half;
          else if (last !== undefined && Math.abs(s + half - last.s0) < 1e-9) last.s0 = s - half;
          else list.push({ s0: s - half, s1: s + half });
          inCavity.set(key, list);
        }
        const wet: number[] = [];
        const depths: number[] = [];
        const { atlas } = build;
        let spillBlock = SCENE_NONE;
        group.members.forEach((member, mi) => {
          member.runs.forEach((_run, ri) => {
            const stretches = inCavity.get(mi * 65536 + ri);
            if (stretches === undefined) return;
            const patchIndex =
              member.linePatch >= 0 ? member.linePatch : (member.runPatch[ri] as number);
            const patch = atlas.patches[patchIndex] as AtlasPatch;
            if (patch.kind !== PATCH_KIND.rev) return;
            for (let row = 0; row < patch.rowCount; row++) {
              // Arc length of the row centre on the member's meridian.
              const s =
                member.linePatch >= 0
                  ? 0.5 * Math.PI * member.radius + (row + 0.5) * (patch.length / patch.rowCount)
                  : (row + 0.5) * patch.da;
              if (!stretches.some((stretch) => s >= stretch.s0 && s <= stretch.s1)) continue;
              const first = atlas.rows[2 * (patch.rowStart + row)] as number;
              const cols = atlas.rows[2 * (patch.rowStart + row) + 1] as number;
              for (let col = 0; col < cols; col++) {
                const local = atlas.cellBlock[first + col] as number;
                if (local === 0xffffffff || atlas.blockCell[local] !== first + col) continue;
                const block = build.blockOf[local] as number;
                if (block === SCENE_NONE) continue;
                const depth = spillLevel - (centre[3 * block + 2] as number);
                if (depth > 0) {
                  wet.push(block);
                  depths.push(depth);
                }
              }
            }
            if (
              member === group.members[group.member[crest] as number] &&
              ri === group.run[crest] &&
              member.linePatch < 0
            ) {
              const q = affinePoint(patch.frame, spillItem[0], spillItem[1], spillItem[2]);
              const where = atlasCellAt(
                atlas,
                patchIndex,
                group.s[crest] as number,
                Math.atan2(q[1], q[0]),
              );
              if (where.block !== 0xffffffff) spillBlock = build.blockOf[where.block] as number;
            }
          });
        });
        // Ascending block order, whatever order the members came in.
        const order = wet.map((_b, i) => i).sort((p, q) => (wet[p] as number) - (wet[q] as number));
        const wetBlocks = Uint32Array.from(order, (i) => wet[i] as number);
        for (const block of wetBlocks)
          blocks.flags[block] = (blocks.flags[block] as number) | BLOCK_FLAG.basin;
        basins.push({
          id: basins.length,
          instance: build.instance.index,
          parts: group.members.map(
            (member) => (atlas.shape.parts[member.part] as { id: string }).id,
          ),
          opening: cavity.sigma,
          volume,
          spillLevel,
          floorLevel: originTub[2] + lowest,
          spillPoint,
          spillBlock,
          levelTable,
          blocks: wetBlocks,
          depth: Float32Array.from(order, (i) => depths[i] as number),
        });
      }
    }
  }
  return basins;
}
