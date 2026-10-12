/**
 * Basins by filling the terrain of an item: the water a hollow of any shape holds before it
 * spills (docs/design/sim-core.md section 3.7 item 5; review of the first build: an upright
 * box shell held no water). `basins.ts` finds the cavities of coaxial bodies of revolution in
 * closed form; this module finds every other hollow of a wash item that is open to the sky:
 * box shells (food containers, trays, oven dishes, tins), stretched shells (spoon bowls, oval
 * platters), troughs away from an axis.
 *
 * **How.** Seen from above, an item in its pose is a terrain: over a grid of columns
 * (`scene.basinGridRatio` blocks wide, so that the blocks of a wall leave no gap between
 * columns) the height of a column is that of its highest block. The terrain is filled as a
 * digital elevation model is (a priority flood from the outside inwards, Barnes et al.): the
 * water level of a column is the lowest crest on the lowest way out of it. Columns whose
 * level stands above their terrain, joined edge to edge at one level, are a pool; the column
 * the level came from is its crest, where it spills. A column whose highest block is
 * perforated lets the water out.
 *
 * **How much.** With n the outward normal of the surface (into the water) and A the area of a
 * block, the volume under the level L is the sum of A n_z (L - z) over the blocks of the pool
 * that face up and lie below L (divergence theorem on the wetted surface, one point per
 * block): a floor adds its area times the depth, a wall that leans out its projection.
 *
 * Simplifications (each ignores something calibration may ask for): a hollow under an
 * overhang is not seen (a bottle tipped past the horizontal, the inside of a jar with a
 * shoulder: only the column of the mouth); one point per block, so a volume is good to about
 * one block over the floor, a few per cent for a container, 10 to 20 % for a spoon; rounded
 * inner edges, whose area the atlas adds to the adjoining faces, count as those faces; only
 * the item itself bounds a pool (a hollow closed by a neighbour is not found); a slot or hole
 * narrower than a column is closed.
 *
 * Deterministic: columns and blocks in index order; ties in the heap by column index.
 *
 * Units: SI. Frame: tub frame.
 */

import { BASIN_LEVELS } from './params.ts';
import type { SceneBuild } from './scene-internal.ts';
import { BLOCK_FLAG, type SceneBasin } from './scene-types.ts';

/** A binary min-heap of columns by (level, index). */
class Heap {
  private readonly key: number[] = [];
  private readonly block: number[] = [];

  get size(): number {
    return this.block.length;
  }

  clear(): void {
    this.key.length = 0;
    this.block.length = 0;
  }

  private less(i: number, j: number): boolean {
    const a = this.key[i] as number;
    const b = this.key[j] as number;
    return a < b || (a === b && (this.block[i] as number) < (this.block[j] as number));
  }

  private swap(i: number, j: number): void {
    const k = this.key[i] as number;
    this.key[i] = this.key[j] as number;
    this.key[j] = k;
    const b = this.block[i] as number;
    this.block[i] = this.block[j] as number;
    this.block[j] = b;
  }

  push(key: number, block: number): void {
    let i = this.block.length;
    this.key.push(key);
    this.block.push(block);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** Removes and returns the lowest block. The heap must not be empty. */
  pop(): number {
    const top = this.block[0] as number;
    const last = this.block.length - 1;
    this.swap(0, last);
    this.key.pop();
    this.block.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < last && this.less(l, m)) m = l;
      if (r < last && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}

/** A block below this vertical component of its normal does not carry a column of water. */
const FACING_UP = 0.1;

/**
 * Finds the hollows of every wash item that `existing` (the analytic basins, whose blocks
 * carry the `basin` flag) does not cover, and returns them with ids that continue `existing`.
 * Sets the `basin` flag of the blocks under water.
 */
export function findFloodBasins(scene: SceneBuild, existing: readonly SceneBasin[]): SceneBasin[] {
  const { params, blocks, centre, normal } = scene;
  const found: SceneBasin[] = [];
  const heap = new Heap();
  const zOf = (b: number): number => centre[3 * b + 2] as number;
  // The blocks the closed-form basins hold: a pool that shares one of them is theirs.
  const analytic = new Uint8Array(blocks.count);
  for (const basin of existing) for (const b of basin.blocks) analytic[b] = 1;

  for (const build of scene.instances) {
    const instance = build.instance;
    if (instance.kind !== 'item' || instance.blockCount === 0) continue;
    const first = instance.firstBlock;
    const end = first + instance.blockCount;
    // Only an item with a pit outside the analytic basins can hold more water.
    let pits = false;
    for (let b = first; b < end && !pits; b++) {
      const flags = blocks.flags[b] as number;
      pits = (flags & BLOCK_FLAG.pit) !== 0 && (flags & BLOCK_FLAG.basin) === 0;
    }
    if (!pits) continue;

    // ---- the terrain
    const h = params.basinGridRatio * instance.blockSize;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let b = first; b < end; b++) {
      const x = centre[3 * b] as number;
      const y = centre[3 * b + 1] as number;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    // One column of nothing all round.
    const nx = Math.floor((x1 - x0) / h) + 3;
    const ny = Math.floor((y1 - y0) / h) + 3;
    const cells = nx * ny;
    const columnOf = (b: number): number =>
      (Math.floor(((centre[3 * b + 1] as number) - y0) / h) + 1) * nx +
      Math.floor(((centre[3 * b] as number) - x0) / h) +
      1;
    const terrain = new Float64Array(cells).fill(-Infinity);
    const top = new Int32Array(cells).fill(-1);
    for (let b = first; b < end; b++) {
      const c = columnOf(b);
      const z = zOf(b);
      if (z > (terrain[c] as number)) {
        terrain[c] = z;
        top[c] = b;
      }
    }
    // A column whose highest block looks down (the leaning outer face of a wall, under a rim
    // that carries no block of its own) is solid up to a surface the blocks do not show: it
    // stands as high as the highest column beside it, not as a trench along the wall.
    {
      const lifted = Float64Array.from(terrain);
      for (let c = 0; c < cells; c++) {
        const b = top[c] as number;
        if (b < 0 || !((normal[3 * b + 2] as number) < -FACING_UP)) continue;
        const cx = c % nx;
        const cy = (c - cx) / nx;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ax = cx + dx;
            const ay = cy + dy;
            if (ax < 0 || ay < 0 || ax >= nx || ay >= ny) continue;
            const t = terrain[ay * nx + ax] as number;
            if (t > (lifted[c] as number)) lifted[c] = t;
          }
        }
      }
      terrain.set(lifted);
    }
    // A perforated top lets the water through.
    const open = new Uint8Array(cells);
    for (let c = 0; c < cells; c++) {
      const b = top[c] as number;
      if (b < 0 || ((blocks.flags[b] as number) & BLOCK_FLAG.porous) !== 0) open[c] = 1;
    }

    // ---- the fill: from the open columns inwards, lowest level first
    const level = new Float64Array(cells).fill(-Infinity);
    const cameFrom = new Int32Array(cells).fill(-1);
    const seen = new Uint8Array(cells);
    heap.clear();
    for (let c = 0; c < cells; c++) {
      if (open[c] === 1) {
        seen[c] = 1;
        heap.push(-Infinity, c);
      }
    }
    while (heap.size > 0) {
      const c = heap.pop();
      const w = level[c] as number;
      const cx = c % nx;
      const cy = (c - cx) / nx;
      for (let k = 0; k < 4; k++) {
        const ax = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ay = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (ax < 0 || ay < 0 || ax >= nx || ay >= ny) continue;
        const a = ay * nx + ax;
        if (seen[a] === 1) continue;
        seen[a] = 1;
        const t = terrain[a] as number;
        if (t >= w) {
          level[a] = t;
        } else {
          level[a] = w;
          cameFrom[a] = c;
        }
        heap.push(level[a] as number, a);
      }
    }

    // ---- pools: columns under water joined edge to edge
    const pool = new Int32Array(cells).fill(-1);
    const stack: number[] = [];
    let pools = 0;
    for (let c0 = 0; c0 < cells; c0++) {
      if (pool[c0] !== -1 || open[c0] === 1) continue;
      if (!((level[c0] as number) - (terrain[c0] as number) > params.basinMinDepth)) continue;
      const id = pools++;
      const members: number[] = [];
      const surface = level[c0] as number;
      pool[c0] = id;
      stack.push(c0);
      while (stack.length > 0) {
        const c = stack.pop() as number;
        members.push(c);
        const cx = c % nx;
        const cy = (c - cx) / nx;
        for (let k = 0; k < 4; k++) {
          const ax = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
          const ay = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (ax < 0 || ay < 0 || ax >= nx || ay >= ny) continue;
          const a = ay * nx + ax;
          if (pool[a] !== -1 || open[a] === 1) continue;
          // Any column the same water stands in, however shallow.
          if ((level[a] as number) !== surface || !((terrain[a] as number) < surface)) continue;
          pool[a] = id;
          stack.push(a);
        }
      }
      members.sort((p, q) => p - q);
      // The crest: follow the level back to the column that set it.
      let crestColumn = members[0] as number;
      while ((cameFrom[crestColumn] as number) >= 0) crestColumn = cameFrom[crestColumn] as number;
      const crest = top[crestColumn] as number;
      if (crest < 0) continue;

      // The blocks of the pool: those of its columns and of the columns round them (the foot
      // of a wall lies in the wall's column) that face up, or sideways towards the pool, and
      // lie below the surface.
      const near = new Uint8Array(cells);
      for (const c of members) {
        const cx = c % nx;
        const cy = (c - cx) / nx;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) near[(cy + dy) * nx + cx + dx] = 1;
        }
      }
      const wet: number[] = [];
      let floor = Infinity;
      let overlap = false;
      for (let b = first; b < end; b++) {
        const z = zOf(b);
        if (!(z < surface)) continue;
        const c = columnOf(b);
        if (near[c] !== 1) continue;
        const nz = normal[3 * b + 2] as number;
        if (((blocks.flags[b] as number) & BLOCK_FLAG.line) !== 0) continue;
        if (pool[c] === id) {
          // Under the surface of a pool column: wetted unless it faces down (an underside).
          if (nz < -FACING_UP) continue;
          // A side face below the terrain of its column faces the outside of a thin wall.
          if (nz <= FACING_UP && z < (terrain[c] as number) - h) continue;
        } else {
          // In a column beside the pool: a face that looks towards a pool column.
          if (nz < -FACING_UP) continue;
          const cx = c % nx;
          const cy = (c - cx) / nx;
          const px = normal[3 * b] as number;
          const py = normal[3 * b + 1] as number;
          let towards = false;
          for (let k = 0; k < 4 && !towards; k++) {
            const dx = k === 0 ? 1 : k === 1 ? -1 : 0;
            const dy = k === 2 ? 1 : k === 3 ? -1 : 0;
            if (pool[(cy + dy) * nx + cx + dx] !== id) continue;
            towards = px * dx + py * dy > FACING_UP || nz > FACING_UP;
          }
          if (!towards) continue;
          // A face that looks up from below the terrain of a pool column next to it is
          // outside the vessel (a handle, a flange): leave it out.
          if (z < floorOfNeighbours(c) - h) continue;
        }
        if (analytic[b] === 1) overlap = true;
        wet.push(b);
        if (z < floor) floor = z;
      }
      function floorOfNeighbours(c: number): number {
        const cx = c % nx;
        const cy = (c - cx) / nx;
        let low = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const a = (cy + dy) * nx + cx + dx;
            if (pool[a] === id && (terrain[a] as number) < low) low = terrain[a] as number;
          }
        }
        return low;
      }
      if (overlap || wet.length === 0) continue;
      const volumeAt = (l: number): number => {
        let v = 0;
        for (const b of wet) {
          const nz = normal[3 * b + 2] as number;
          const depth = l - zOf(b);
          if (nz > FACING_UP && depth > 0) v += (blocks.area[b] as number) * nz * depth;
        }
        return v;
      };
      const levelTable = new Float32Array(2 * BASIN_LEVELS);
      for (let k = 0; k < BASIN_LEVELS; k++) {
        const depth = ((surface - floor) * k) / (BASIN_LEVELS - 1);
        levelTable[2 * k] = depth;
        levelTable[2 * k + 1] = volumeAt(floor + depth);
      }
      const volume = levelTable[2 * BASIN_LEVELS - 1] as number;
      if (!(volume >= params.basinMinVolume)) continue;
      const parts: string[] = [];
      for (const b of wet) {
        blocks.flags[b] = (blocks.flags[b] as number) | BLOCK_FLAG.basin;
        const local = (blocks.part[b] as number) - instance.firstPart;
        const partId = (build.atlas.shape.parts[local] as { id: string } | undefined)?.id;
        if (partId !== undefined && !parts.includes(partId)) parts.push(partId);
      }
      found.push({
        id: existing.length + found.length,
        instance: instance.index,
        parts,
        opening: 1,
        volume,
        spillLevel: surface,
        floorLevel: floor,
        spillPoint: [
          centre[3 * crest] as number,
          centre[3 * crest + 1] as number,
          centre[3 * crest + 2] as number,
        ],
        spillBlock: crest,
        levelTable,
        blocks: Uint32Array.from(wet),
        depth: Float32Array.from(wet, (b) => surface - zOf(b)),
      });
    }
  }
  return found;
}
