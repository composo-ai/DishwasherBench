/**
 * The kinematic cascade of the first build (docs/design/scope.md, "Surface water";
 * docs/design/sim-core.md sections M7.3, M7.5 to M7.7; docs/research/films.md sections 3, 5,
 * 6.4, 8 and 12): water on every surface of the scene, block by block on the cell graph.
 *
 *   state      per block: film mass m and bead store b in whole units of `WATER_UNIT`, a regime
 *              (dry, beads, rivulet, film) and the wetted width fraction f of a rivulet
 *   inflow     what the jets hand over in this phase bin, the droplets that land (a steady
 *              share of their per-revolution deposit), and what the blocks above and the drip
 *              sites above pass on (blocks are visited from the highest down, so that arrives
 *              in the same step)
 *   outflow    implicit: m' + dt Q(m') = a, with the discharge of the films dossier's friction
 *              law, Q = rho W f q_eq(h / f), q_eq = min(g_s h^3 / (3 nu), turbulent branch);
 *              along a wire Q = g_l lambda^2 / (rho k_w nu). What leaves is the integer
 *              a - m', so water is conserved exactly whatever the solve does
 *   routing    to the downhill neighbours in proportion to the shared edge seen by the flow
 *              direction; a share across contacts to the body below; from a drip site through
 *              the landing table of its drops (`DripTransfer`) onto whatever is below; into
 *              the basin whose low point it reaches (basins are full: what enters spills on
 *              to the first block outside the cavity beside the spill point); at the tub floor
 *              and on the spray arms, to the sump
 *   wetting    airborne water collects as beads until the onset mass of the shared wetting
 *              threshold, then joins the film; on a material that dewets (receding angle above
 *              `film.thetaFilm`; by degrees, fully from `film.thetaFilmWidth` above it: the
 *              ramp r) a thin stream is a rivulet of width fraction 1 - r (1 - f),
 *              f = max(f_min, f_1 (Gamma / Gamma*_a)^(1/4)), until its loading reaches Gamma*_a
 *              or the block holds enough to cover it delta*_a thick; a film on a material
 *              that dewets breaks back into a rivulet after its loading has been below
 *              Gamma*_r for the dewetting time, and leaves drops on the part it uncovers
 *              (`film.dewetBeadShare` of the bead capacity, films 8.2); a rivulet whose thread
 *              is thinner than delta_wet breaks into beads
 *   age        from the mean flows of the recorded revolutions, the mean time since the water
 *              on a block left the air (`CascadeResult.age`): every block is a stirred store,
 *              age out = flux-weighted age in + water on the block over its throughput; water
 *              from the jets and the droplets arrives with age 0, a full basin adds its volume
 *              over its inflow. It does not depend on the block size (a chain of stirred
 *              stores has the residence time of the run it stands for)
 *   driver     a pilot at a coarse step, settle revolutions, recorded revolutions (wet
 *              fraction, thickness, flux, shear, renewal), then the drain-down with the sprays
 *              off (what is retained, and how long a block stays wet)
 *
 * Simplifications (each ignores something calibration may ask for):
 *  - no film inertia, no hydrostatic or capillary pressure along the surface: a film goes
 *    where gravity takes it and spreads sideways only by the split between its downhill
 *    neighbours; `film.minSlope` stands for the head of the film on level ground; the step is
 *    first-order (backward Euler, upwind), which smears a pulse over a few blocks;
 *  - a level upward face that is not a basin is a puddle of `film.puddleDepth` whose excess
 *    walks by the shortest way to the edge of the face (not a lake solve); a hollow the scene
 *    does not report as a basin (box shells, stretched shells) holds a puddle of that depth
 *    and returns the rest to the sump;
 *  - the regime of a block follows its own loading, not that of a regime group; the wetted
 *    fraction of a block is one number (no rivulet positions, no coverage ranks);
 *  - contact angles are those of the material in one liquor class (`film.liquorClass`), with
 *    no random offset field and no soil cover;
 *  - a drip site passes on what reaches it at once (beyond what the edge holds back), as drops
 *    of one size from rest, with no delay for the fall;
 *  - basins are full from the start, so the overflow of an upright vessel runs down its
 *    outside before the vessel has really filled (the replay fills the pool itself);
 *  - what a block holds back (pendant ridge, puddle, bridge) is made up at once when water
 *    first reaches it during the pilot, from outside the water balance (reported as `primed`),
 *    so that the recorded revolutions are near the periodic state without the tens of seconds
 *    it takes to load every edge;
 *  - the march begins with `film.soakSteps` long steps, each standing for
 *    `film.soakRevolutions` revolutions with the time-mean forcing of a revolution (the
 *    implicit step is stable at any length and, long, lands on the steady state): a face that
 *    only thin spray reaches collects drops for minutes before it wets, and its thin film
 *    takes as long to fill, far longer than the revolutions that follow. Without them nothing
 *    left such a face in the recorded revolutions, and its `renewal` and `exchange` read 0
 *    below a rate of arrival set by the length of the march, not by any physics. A face that
 *    receives so little that it does not wet in the time the soak stands for still reads 0.
 *    On a material that dewets, the film of a thinly fed face breaks back into drops, which
 *    collect for minutes before they run again: the recorded revolutions see one moment of
 *    that cycle;
 *  - a contact passes a fixed share of the discharge down and holds a meniscus of
 *    `film.bridgeDepth` on the area that faces it;
 *  - gap reservoirs (sim-core M7.6): a block that faces another body closer than
 *    `film.gapReservoirWidth` capillary lengths, and lies within the capillary rise height of
 *    its gap above the lowest block of its patch of such blocks, holds half the width of the
 *    gap as standing water (the block that the top of the column crosses, its share below
 *    it). The rise is measured from the low point of the patch whatever
 *    closes it (an open lower edge holds a little less); in the water balance and in the age
 *    of what flows on, the held water is one stirred store with the film (the table gives the
 *    liquor IN the gap its own, slower exchange: `film.etaGap`, see `surface-stage.ts`); a
 *    gap wider than `scene.contactGap` is not seen, a perforated
 *    part (the lattice of the cutlery basket) bridges nothing, and droplets and jets are not
 *    kept out of a gap whose mouth a plug closes;
 *  - what a block holds back (pendant ridge, puddle, meniscus) stands still: it is in the
 *    block's water and in what is retained, not in the thickness and shear of its film, and
 *    it does not make a rivulet a film;
 *  - a drip site inside a level underside keeps a pendant film per area, any other a ridge
 *    per length of edge; a rim two blocks wide at the fine tier and one at the coarse keeps
 *    up to twice the ridge at the fine tier. A lower edge or an underside that is not level
 *    (its blocks face down and pass their water on along the surface) keeps its ridge or its
 *    pendant film while the drops are pinned (Furmidge, `film.dropPinning`), and beyond that
 *    tilt a share that falls as one over the sine of the tilt: what an edge keeps does not
 *    jump when an item is tipped by a fraction of a degree;
 *  - water on a spray arm goes to the sump; the arms' own drips are not traced;
 *  - no evaporation; no thermal state.
 *
 * Deterministic: one thread, blocks in a fixed order (by height, then index), integers.
 *
 * Units: SI; masses in units of `WATER_UNIT` where stated. Frame: tub frame.
 */

import {
  bindSharedClosures,
  BLOCK_FLAG,
  DRIP_TO_FLOOR,
  DRIP_WEIGHT_ONE,
  resolveSprayParams,
  SCENE_NONE,
  WATER_UNIT,
  type DripTransfer,
  type JetHandover,
  type ParamSet,
  type WashScene,
} from '@spotless/sim-spray';
import { resolveFilmParams, type FilmParams } from './params.ts';

/** What a block does with the water that reaches it. */
export const BLOCK_KIND = {
  /** Passes it to its downhill neighbours. */
  normal: 0,
  /** A drip site: passes it on through the landing table of its drops. */
  drip: 1,
  /** A level upward face: keeps a puddle and spills the rest to its level neighbours. */
  pit: 2,
  /** A low point of a basin: hands it to the basin. */
  basin: 3,
  /** The tub floor or a spray arm: hands it to the sump. */
  sump: 4,
} as const;

/** Regimes of a block. */
export const REGIME = { dry: 0, bead: 1, rivulet: 2, film: 3 } as const;

/** The whole of a block's outflow in receiver weights. */
// literal-ok-begin: buffer size or fixed-point scale
const WEIGHT_ONE = 65536;
// literal-ok-end

/** Arithmetic controls of the cascade (not physical quantities). */
export const CASCADE_NUMERICS = {
  /** Most downhill receivers and most contact receivers of a block. */
  maxReceivers: 6,
  maxContacts: 4,
  /** Newton iterations of the implicit outflow (fixed count). */
  newton: 3,
  /** A neighbour within this share of the block size above a pit still takes its spill. */
  pitLevel: 0.25,
  /** Rings of neighbours searched about a spill point for a block outside the basin. */
  outletReach: 8,
  /**
   * A drip site is inside a level underside when its normal points down by more than the
   * first (a cosine: 45 degrees) and more than the third (a share) of its neighbours have
   * normals within the second of its own (a cosine: 32 degrees).
   */
  // literal-ok-begin: named arithmetic control, documented where it is declared
  undersideNormal: 0.7,
  undersideAlike: 0.85,
  undersideShare: 0.75,
  // literal-ok-end
  /**
   * Sweeps of the age pass over the blocks (highest first). One is exact where water only
   * runs downhill; each further sweep carries the age one step along a way back up the order
   * (across a level puddle, out of a basin).
   */
  ageSweeps: 4,
} as const;

/** Liquid properties the cascade is solved with. */
export interface FilmLiquid {
  readonly rho: number;
  readonly mu: number;
  readonly nu: number;
  /** Surface tension of the liquor, N/m. */
  readonly sigma: number;
  /** Liquor class index into the contact-angle columns (0 W, 1 D, 2 R). */
  readonly liquorClass: number;
}

/**
 * Steady flux of a film of thickness `h` (m) under gravity `gs` (m/s2) along the surface, per
 * unit width, m2/s: the lower of the laminar (Nusselt) and turbulent branches of the friction
 * law f = max(24 / Re, c Re^(-n)), Re = 4 q / nu.
 */
export function equilibriumFlux(fp: FilmParams, h: number, gs: number, nu: number): number {
  if (!(h > 0) || !(gs > 0)) return 0;
  // (1/2) f rho u^2 = rho g_s h with f = 24 nu / (4 u h) gives u = g_s h^2 / (3 nu).
  const laminar = (8 * gs * h * h * h) / (fp.frictionLam * nu);
  const n = fp.frictionTurbExp;
  const u = Math.pow(((2 * gs * h) / fp.frictionTurbCoef) * Math.pow((4 * h) / nu, n), 1 / (2 - n));
  return Math.min(laminar, h * u);
}

/** Thickness of a laminar film that carries the mass flow `gamma` per unit width, m (Nusselt). */
export function nusseltThickness(gamma: number, gs: number, rho: number, nu: number): number {
  return Math.cbrt((3 * nu * gamma) / (rho * gs));
}

/** The tables of a scene that do not change during a solve. */
export interface CascadeStatic {
  readonly liquid: FilmLiquid;
  /** {@link BLOCK_KIND} per block. */
  readonly kind: Uint8Array;
  /** Receivers of block `i`: entries `recvOffsets[i] .. recvOffsets[i + 1] - 1`. */
  readonly recvOffsets: Uint32Array;
  readonly recvBlock: Uint32Array;
  /** Share of the outflow in 1 / 65536. */
  readonly recvWeight: Uint32Array;
  /** Row of `scene.drips` of a drip site, basin of a basin sink; -1 otherwise. */
  readonly dripRow: Int32Array;
  readonly basinOf: Int32Array;
  /** 1 for a line element. */
  readonly line: Uint8Array;
  /**
   * Discharge coefficients, per second and in units: a film passes `lam y^3 / f^2`, a line
   * `lam y^2`, a turbulent film `turb y^p / f^(p - 1)`, with y the units above `hold`.
   */
  readonly lam: Float64Array;
  readonly turb: Float64Array;
  /** Units per wetted width fraction above which the turbulent branch is the lower. */
  readonly turbFrom: Float64Array;
  /** Exponent p of the turbulent branch. */
  readonly turbExp: number;
  /** Units a block holds back (pendant ridge, puddle, bridge). */
  readonly hold: Float64Array;
  /** Width across the flow, m. */
  readonly width: Float32Array;
  /** Length of the block along the flow, m (the area over the width; the length of a line element). */
  readonly run: Float32Array;
  /**
   * Gap to the nearest other body in front of the block, m, from the contact links of the
   * scene (which reach to `scene.contactGap`); Infinity where nothing is that near.
   */
  readonly gap: Float32Array;
  /** Units a block holds as its half of a liquid-filled gap (part of `hold`); 0 outside a gap reservoir. */
  readonly reservoir: Float64Array;
  /** Wall shear per unit of film mass over f, Pa per unit. */
  readonly tauCoef: Float32Array;
  /** Units at the thickness delta_wet, at the bead capacity b_max and at delta_dry. */
  readonly mWet: Float32Array;
  readonly bMax: Float32Array;
  readonly mDry: Float32Array;
  /** Loading thresholds Gamma*_a and Gamma*_r, kg/(m s). */
  readonly gammaA: Float32Array;
  readonly gammaR: Float32Array;
  /** Dewetting time of a film, s; Infinity where it never breaks up. */
  readonly tDw: Float32Array;
  /**
   * How far the material is on the dewetting side, 0 to 1: 0 at a receding angle of
   * `film.thetaFilm` and below (a film never breaks up), 1 from `film.thetaFilmWidth` above it.
   * The wetted share of a rivulet is 1 - ramp (1 - f).
   */
  readonly ramp: Float32Array;
  /**
   * The blocks from the highest to the lowest (by height of centre, then by index): the order
   * in which a step visits them, so that what a block passes down arrives in the same step.
   */
  readonly order: Uint32Array;
  /**
   * Per basin of the scene: the block its overflow runs on to, the nearest block beside its
   * spill point that lies outside the cavity and below the spill level; -1 where there is
   * none (the overflow then returns to the sump).
   */
  readonly basinOutlet: Int32Array;
}

function compare(a: number, b: number): number {
  return a - b;
}

/**
 * Builds the static tables of the cascade for a scene: where each block's water goes, its
 * discharge coefficients and its wetting thresholds.
 */
export function buildCascadeStatic(scene: WashScene, params: ParamSet): CascadeStatic {
  const fp = resolveFilmParams(params);
  const closures = bindSharedClosures(params);
  const water = closures.water(params.get('jets.solveTemperature'));
  const liquorClass = params.enumIndex('film.liquorClass');
  const sigmaOf = params.getVector('film.sigma');
  const sigma = sigmaOf[liquorClass] ?? (sigmaOf[0] as number);
  const liquid: FilmLiquid = { rho: water.rho, mu: water.mu, nu: water.nu, sigma, liquorClass };
  const g = scene.gravity;
  const blocks = scene.blocks;
  const n = blocks.count;
  const graph = scene.graph;
  const drips = scene.drips;
  const level = params.get('scene.dripLevelTolerance');
  const centre = blocks.centre;

  const basinOf = new Int32Array(n).fill(-1);
  scene.basins.forEach((basin, k) => {
    for (let i = 0; i < basin.blocks.length; i++) {
      const b = basin.blocks[i] as number;
      if (basinOf[b] === -1) basinOf[b] = k;
    }
  });
  const tubInstance = scene.instances.map((instance) => instance.role === 'tub');
  const armInstance = scene.instances.map((instance) => instance.rotating);

  // Contacts: the upper block of a link passes a share to the lower; both hold a bridge.
  const contactTo: number[][] = [];
  const contactGap: number[][] = [];
  const bridge = new Float64Array(n);
  const slowed = new Uint8Array(n);
  for (let c = 0; c < scene.contacts.count; c++) {
    const gap = scene.contacts.gap[c] as number;
    if (gap > fp.bridgeGap) continue;
    const a = scene.contacts.blockA[c] as number;
    const b = scene.contacts.blockB[c] as number;
    if (a === SCENE_NONE || b === SCENE_NONE) continue;
    // A meniscus per unit of facing area, whatever the number of links (the links of a scene
    // grow with the inverse square of the block size, the water held does not).
    bridge[a] = (liquid.rho * (blocks.area[a] as number) * fp.bridgeDepth) / WATER_UNIT;
    bridge[b] = (liquid.rho * (blocks.area[b] as number) * fp.bridgeDepth) / WATER_UNIT;
    if (gap < fp.gapNoFlow) {
      slowed[a] = 1;
      slowed[b] = 1;
    }
    const upper = (centre[3 * a + 2] as number) >= (centre[3 * b + 2] as number) ? a : b;
    const lower = upper === a ? b : a;
    (contactTo[upper] ??= []).push(lower);
    (contactGap[upper] ??= []).push(gap);
  }

  // Gap reservoirs (sim-core M7.6; standards P04, P15, P40): blocks of an item that face
  // another body closer than `film.gapReservoirWidth` capillary lengths are joined into
  // patches over the cell graph; a block of a patch within the capillary rise height of its
  // own gap, 2 sigma cos(theta_r) / (rho g w), above the lowest block of the patch stands in
  // liquid that bridges the gap, and holds half the width of the gap.
  // (A perforated part, such as the lattice of the cutlery basket, is not a wall that liquid
  // bridges to: its open share is not known to the scene. A contact with it keeps the
  // meniscus of `film.bridgeDepth` only.)
  const gap = new Float32Array(n).fill(Infinity);
  for (let c = 0; c < scene.contacts.count; c++) {
    const a = scene.contacts.blockA[c] as number;
    const b = scene.contacts.blockB[c] as number;
    if (a === SCENE_NONE) continue;
    if (b !== SCENE_NONE && ((blocks.flags[b] as number) & BLOCK_FLAG.porous) !== 0) continue;
    const w = scene.contacts.gap[c] as number;
    if (w < (gap[a] as number)) gap[a] = w;
  }
  const reservoir = new Float64Array(n);
  {
    const capillaryLength = Math.sqrt(sigma / (liquid.rho * g));
    const narrow = fp.gapReservoirWidth * capillaryLength;
    const isNarrow = (b: number): boolean =>
      (gap[b] as number) < narrow && ((blocks.flags[b] as number) & BLOCK_FLAG.line) === 0;
    const patchOf = new Int32Array(n).fill(-1);
    const members: number[] = [];
    for (let seed = 0; seed < n; seed++) {
      if (patchOf[seed] !== -1 || !isNarrow(seed)) continue;
      members.length = 0;
      members.push(seed);
      patchOf[seed] = seed;
      // The low point of the patch: the lower edge of its lowest block.
      const reach = (b: number): number =>
        // literal-ok-begin: half of the height of a block
        0.5 * Math.sqrt(blocks.area[b] as number) * Math.abs(Math.sin(blocks.tilt[b] as number));
      // literal-ok-end
      let low = (centre[3 * seed + 2] as number) - reach(seed);
      for (let head = 0; head < members.length; head++) {
        const b = members[head] as number;
        const z = (centre[3 * b + 2] as number) - reach(b);
        if (z < low) low = z;
        for (let e = graph.offsets[b] as number; e < (graph.offsets[b + 1] as number); e++) {
          const j = graph.neighbour[e] as number;
          if (patchOf[j] !== -1 || !isNarrow(j)) continue;
          patchOf[j] = seed;
          members.push(j);
        }
      }
      for (const b of members) {
        const w = gap[b] as number;
        const material = scene.materials[blocks.material[b] as number];
        const thetaR =
          material === undefined ? 0 : (material.receding[liquorClass] ?? material.receding[1]);
        const wetting = Math.max(0, Math.cos(thetaR ?? 0));
        const rise = w > 0 ? (2 * sigma * wetting) / (liquid.rho * g * w) : Infinity;
        // The share of the block below the top of the column: the block reaches half its
        // own height (its side along the slope times the sine of its tilt) above and below
        // its centre, so the cut moves through a block and not from block to block.
        const height = (centre[3 * b + 2] as number) - low;
        const extent = 2 * reach(b);
        // literal-ok-begin: half of the height of a block; each of the two surfaces of a gap holds half its width
        const below =
          extent > 0
            ? Math.min(1, Math.max(0, (rise - height) / extent + 0.5))
            : height > rise
              ? 0
              : 1;
        if (!(below > 0)) continue;
        reservoir[b] = (below * liquid.rho * (blocks.area[b] as number) * 0.5 * w) / WATER_UNIT;
        // literal-ok-end
      }
    }
  }

  const kind = new Uint8Array(n);
  const dripRow = new Int32Array(n).fill(-1);
  const line = new Uint8Array(n);
  const width = new Float32Array(n);
  const run = new Float32Array(n);
  const candidates: { block: number; weight: number; slope: number }[] = [];
  const sharedEdge = (e: number, side: number): number =>
    // literal-ok-begin: arithmetic control (a share used in a rule of the grid, not a physical quantity)
    (graph.length[e] as number) > 0 ? (graph.length[e] as number) : 0.1 * side;
  // literal-ok-end

  /**
   * Fills `candidates` with the downhill neighbours of block `i`, weighted by the shared edge
   * as the flow direction sees it (by slope where no neighbour lies along the flow). Returns
   * the width of the block across the flow, or 0.
   */
  const downhill = (i: number, side: number): number => {
    candidates.length = 0;
    const zi = centre[3 * i + 2] as number;
    const gx = blocks.gravityDir[3 * i] as number;
    const gy = blocks.gravityDir[3 * i + 1] as number;
    const gz = blocks.gravityDir[3 * i + 2] as number;
    let across = 0;
    for (let e = graph.offsets[i] as number; e < (graph.offsets[i + 1] as number); e++) {
      const j = graph.neighbour[e] as number;
      const drop = zi - (centre[3 * j + 2] as number);
      if (!(drop > level)) continue;
      const dx = (centre[3 * j] as number) - (centre[3 * i] as number);
      const dy = (centre[3 * j + 1] as number) - (centre[3 * i + 1] as number);
      const dz = (centre[3 * j + 2] as number) - zi;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const shared = sharedEdge(e, side);
      const cosine = dist > 0 ? (gx * dx + gy * dy + gz * dz) / dist : 0;
      const w = cosine > 0 ? shared * cosine : 0;
      across += w;
      candidates.push({ block: j, weight: w, slope: dist > 0 ? (shared * drop) / dist : 0 });
    }
    if (candidates.length > 0 && !(across > 0)) {
      for (const c of candidates) c.weight = c.slope > 0 ? c.slope : 1;
    }
    return across;
  };

  // What each block does with its water.
  for (let i = 0; i < n; i++) {
    const flags = blocks.flags[i] as number;
    const instance = blocks.instance[i] as number;
    line[i] = (flags & BLOCK_FLAG.line) !== 0 ? 1 : 0;
    const side = Math.sqrt(blocks.area[i] as number);
    const row = drips.ofBlock[i] as number;
    let k: number = BLOCK_KIND.normal;
    let across = 0;
    if (armInstance[instance] === true) {
      k = BLOCK_KIND.sump;
    } else if ((flags & BLOCK_FLAG.pit) !== 0) {
      k =
        tubInstance[instance] === true
          ? BLOCK_KIND.sump
          : (basinOf[i] as number) >= 0
            ? BLOCK_KIND.basin
            : BLOCK_KIND.pit;
    } else if ((flags & BLOCK_FLAG.dripSite) !== 0) {
      k = row !== SCENE_NONE ? BLOCK_KIND.drip : BLOCK_KIND.sump;
    } else {
      across = downhill(i, side);
      if (candidates.length === 0) {
        k =
          row !== SCENE_NONE
            ? BLOCK_KIND.drip
            : tubInstance[instance] === true
              ? BLOCK_KIND.sump
              : BLOCK_KIND.pit;
      }
    }
    if (k === BLOCK_KIND.drip) dripRow[i] = row;
    kind[i] = k;
    // The width across the flow is the downhill edge as the flow direction sees it; where the
    // lower neighbours lie well off that direction it is kept within a factor of two of the
    // side of the block (water still leaves through them).
    width[i] = across > 0 ? Math.min(2 * side, Math.max(0.5 * side, across)) : side;
  }

  // Puddles drain towards the nearest way off their level face: steps to an exit, breadth
  // first from the puddle blocks that touch a block which is not a puddle and not above them.
  const exitSteps = new Int32Array(n).fill(-1);
  const frontier: number[] = [];
  const isLevelWith = (i: number, j: number, side: number): boolean =>
    (centre[3 * j + 2] as number) <=
    (centre[3 * i + 2] as number) + CASCADE_NUMERICS.pitLevel * side;
  // A way off a puddle: a neighbour that is not a puddle and not above it (were it above, it
  // would hand the water straight back).
  const isExit = (i: number, j: number): boolean =>
    kind[j] !== BLOCK_KIND.pit &&
    (centre[3 * j + 2] as number) <= (centre[3 * i + 2] as number) + level;
  for (let i = 0; i < n; i++) {
    if (kind[i] !== BLOCK_KIND.pit) continue;
    for (let e = graph.offsets[i] as number; e < (graph.offsets[i + 1] as number); e++) {
      const j = graph.neighbour[e] as number;
      if (isExit(i, j)) {
        exitSteps[i] = 0;
        frontier.push(i);
        break;
      }
    }
  }
  for (let head = 0; head < frontier.length; head++) {
    const i = frontier[head] as number;
    const side = Math.sqrt(blocks.area[i] as number);
    for (let e = graph.offsets[i] as number; e < (graph.offsets[i + 1] as number); e++) {
      const j = graph.neighbour[e] as number;
      if (kind[j] !== BLOCK_KIND.pit || exitSteps[j] !== -1) continue;
      // Water climbs no step: the next puddle block must be level with this one.
      if (!isLevelWith(j, i, side)) continue;
      exitSteps[j] = (exitSteps[i] as number) + 1;
      frontier.push(j);
    }
  }

  // Receivers: contacts first, then the graph.
  const recvOffsets = new Uint32Array(n + 1);
  const recvBlock: number[] = [];
  const recvWeight: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = kind[i] as number;
    const side = Math.sqrt(blocks.area[i] as number);
    candidates.length = 0;
    if (k === BLOCK_KIND.normal) {
      downhill(i, side);
    } else if (k === BLOCK_KIND.pit) {
      const steps = exitSteps[i] as number;
      for (let e = graph.offsets[i] as number; e < (graph.offsets[i + 1] as number); e++) {
        const j = graph.neighbour[e] as number;
        const out =
          steps === 0
            ? isExit(i, j)
            : steps > 0 && kind[j] === BLOCK_KIND.pit && exitSteps[j] === steps - 1;
        if (out) candidates.push({ block: j, weight: sharedEdge(e, side), slope: 0 });
      }
      // A puddle with no way off its face spills into the sump (see the march).
    }
    let contactShare = 0;
    if (k !== BLOCK_KIND.sump && k !== BLOCK_KIND.basin) {
      const to = contactTo[i];
      if (to !== undefined) {
        const gaps = contactGap[i] as number[];
        const order = to
          .map((_, q) => q)
          .sort(
            (p, q) =>
              compare(gaps[p] as number, gaps[q] as number) ||
              compare(to[p] as number, to[q] as number),
          );
        const used: number[] = [];
        for (const q of order) {
          const target = to[q] as number;
          if (!used.includes(target) && used.length < CASCADE_NUMERICS.maxContacts) {
            used.push(target);
          }
        }
        const each = Math.floor((fp.contactTransfer * WEIGHT_ONE) / used.length);
        for (const target of used) {
          if (each <= 0) break;
          recvBlock.push(target);
          recvWeight.push(each);
          contactShare += each;
        }
      }
    }
    if (candidates.length > 0) {
      candidates.sort((p, q) => compare(q.weight, p.weight) || compare(p.block, q.block));
      let useful = 0;
      while (
        useful < candidates.length &&
        useful < CASCADE_NUMERICS.maxReceivers &&
        ((candidates[useful] as { weight: number }).weight > 0 || useful === 0)
      ) {
        useful++;
      }
      candidates.length = useful;
      let total = 0;
      for (const c of candidates) total += c.weight;
      const rest = WEIGHT_ONE - contactShare;
      let given = 0;
      const first = recvBlock.length;
      for (const c of candidates) {
        const w = total > 0 ? Math.floor((rest * c.weight) / total) : 0;
        recvBlock.push(c.block);
        recvWeight.push(w);
        given += w;
      }
      // The rounding goes to the strongest receiver.
      recvWeight[first] = (recvWeight[first] as number) + (rest - given);
    }
    recvOffsets[i + 1] = recvBlock.length;
  }

  // Discharge coefficients and wetting thresholds.
  const lam = new Float64Array(n);
  const turb = new Float64Array(n);
  const turbFrom = new Float64Array(n).fill(Infinity);
  const hold = new Float64Array(n);
  const tauCoef = new Float32Array(n);
  const mWet = new Float32Array(n);
  const bMax = new Float32Array(n);
  const mDry = new Float32Array(n);
  const gammaA = new Float32Array(n);
  const gammaR = new Float32Array(n);
  const tDw = new Float32Array(n).fill(Infinity);
  const ramp = new Float32Array(n);
  // What a drip site holds back. A lower edge keeps `film.edgeHold` per length (drops of 3.3
  // capillary lengths at their natural spacing); a wire keeps less in the ratio of its drop
  // (Tate's law) to that drop; a block inside a level underside keeps a pendant film.
  const sp = resolveSprayParams(params);
  const capillary = Math.sqrt(sigma / (liquid.rho * g));
  const edgeDrop = (liquid.rho * Math.PI * Math.pow(sp.dripDropFactor * capillary, 3)) / 6;
  const wireHold = (radius: number): number =>
    (fp.edgeHold * ((sp.dripTipFactor * sigma * 2 * Math.PI * radius) / g)) / edgeDrop;
  /**
   * Whether a drip site lies inside a level underside (it keeps a pendant film per area) and
   * not on an edge or rim (it keeps a ridge per length): it faces down, and more than three
   * quarters of its neighbours face the way it does. Shares and normals, not counts and
   * heights, so that the answer does not change with the block size.
   */
  const insideUnderside = (i: number): boolean => {
    const nx = blocks.normal[3 * i] as number;
    const ny = blocks.normal[3 * i + 1] as number;
    const nz = blocks.normal[3 * i + 2] as number;
    if (!(nz < -CASCADE_NUMERICS.undersideNormal)) return false;
    let alike = 0;
    let all = 0;
    for (let e2 = graph.offsets[i] as number; e2 < (graph.offsets[i + 1] as number); e2++) {
      const j = graph.neighbour[e2] as number;
      all++;
      if (
        nx * (blocks.normal[3 * j] as number) +
          ny * (blocks.normal[3 * j + 1] as number) +
          nz * (blocks.normal[3 * j + 2] as number) >
        CASCADE_NUMERICS.undersideAlike
      ) {
        alike++;
      }
    }
    return all > 0 && alike > CASCADE_NUMERICS.undersideShare * all;
  };
  const nExp = fp.frictionTurbExp;
  const e = 1 / (2 - nExp);
  const turbExp = 1 + e + nExp * e;
  // Per material: the thresholds on a vertical face (the shared closures, evaluated once).
  const perMaterial = scene.materials.map((material) => {
    const thetaA = material.advancing[liquorClass] ?? material.advancing[1];
    const thetaR = material.receding[liquorClass] ?? material.receding[1];
    return {
      thetaA,
      thetaR,
      deltaA: closures.deltaStar(liquid.mu, sigma, liquid.rho, thetaA, 1),
      deltaR: closures.deltaStar(liquid.mu, sigma, liquid.rho, thetaR, 1),
      bMax: closures.bMax(sigma, liquid.rho, thetaA, thetaR, 1),
      dewet: fp.kDw * (sigma / liquid.mu) * thetaR * thetaR * thetaR,
      ramp:
        fp.thetaFilmWidth > 0
          ? Math.min(1, Math.max(0, (thetaR - fp.thetaFilm) / fp.thetaFilmWidth))
          : thetaR >= fp.thetaFilm
            ? 1
            : 0,
    };
  });
  for (let i = 0; i < n; i++) {
    const area = blocks.area[i] as number;
    const side = Math.sqrt(area);
    const k = kind[i] as number;
    const tilt = blocks.tilt[i] as number;
    const sinBeta = Math.max(Math.abs(Math.sin(tilt)), fp.sinBetaFloor);
    const along = blocks.gravityAlong[i] as number;
    const perUnit = WATER_UNIT / (liquid.rho * area); // thickness of one unit, m
    let gs = Math.max(along, g * fp.minSlope);
    if (k === BLOCK_KIND.drip) gs = Math.max(gs, g * fp.sinBetaFloor);
    const factor = slowed[i] === 1 ? fp.gapFlowFactor : 1;
    const patch = scene.patches[blocks.patch[i] as number];
    if (line[i] === 1) {
      const radius = patch !== undefined && patch.radius > 0 ? patch.radius : side;
      const length = area / (2 * Math.PI * radius);
      // Q = g_l lambda^2 / (rho k_w nu), lambda = m / length.
      lam[i] = (factor * gs * WATER_UNIT) / (liquid.rho * fp.lineKw * liquid.nu * length * length);
      width[i] = length;
      if (k === BLOCK_KIND.drip) hold[i] = (wireHold(radius) * length) / WATER_UNIT;
    } else {
      const w = width[i] as number;
      // Laminar: rho W g_s h^3 8 / (f_lam nu), h = y perUnit.
      lam[i] =
        (factor * liquid.rho * w * 8 * gs * perUnit * perUnit * perUnit) /
        (fp.frictionLam * liquid.nu * WATER_UNIT);
      const kt = Math.pow((2 * gs) / fp.frictionTurbCoef, e) * Math.pow(4 / liquid.nu, nExp * e);
      turb[i] = (factor * liquid.rho * w * kt * Math.pow(perUnit, turbExp)) / WATER_UNIT;
      // The branches cross where (8 g_s / (f_lam nu)) h^3 = k_t h^p.
      const cross = Math.pow((fp.frictionLam * liquid.nu * kt) / (8 * gs), 1 / (3 - turbExp));
      turbFrom[i] = cross / perUnit;
      if (k === BLOCK_KIND.drip) {
        hold[i] = insideUnderside(i)
          ? (liquid.rho * area * fp.undersideHold) / WATER_UNIT
          : (fp.edgeHold * side) / WATER_UNIT;
      } else if (
        k === BLOCK_KIND.normal &&
        (blocks.normal[3 * i + 2] as number) < -CASCADE_NUMERICS.undersideNormal
      ) {
        // A lower edge or an underside that is not level: water runs along it to its low
        // point, but the pendant drops it is left with stay where they are while their weight
        // along the surface is less than what the contact line can hold (Furmidge, films
        // 5.7): rho g V sin(beta) <= k w sigma (cos theta_r - cos theta_a). With the drops of
        // a ridge (`film.edgeHold` per length, one per drop width w) that is the whole ridge
        // up to sin(beta_0) = k sigma (cos theta_r - cos theta_a) / (g edgeHold), and beyond
        // it the share sin(beta_0) / sin(beta): the edge keeps only drops small enough to
        // hold. Under a face the drops of the pendant film (`film.undersideHold`, one per w
        // squared) weigh rho undersideHold w^2 each, w the width of a drop that drips.
        const z = blocks.centre[3 * i + 2] as number;
        let steepest = 0;
        for (let e2 = graph.offsets[i] as number; e2 < (graph.offsets[i + 1] as number); e2++) {
          const j = graph.neighbour[e2] as number;
          const drop = z - (blocks.centre[3 * j + 2] as number);
          if (!(drop > 0)) continue;
          const distance = Math.hypot(
            (blocks.centre[3 * j] as number) - (blocks.centre[3 * i] as number),
            (blocks.centre[3 * j + 1] as number) - (blocks.centre[3 * i + 1] as number),
            drop,
          );
          if (distance > 0 && drop / distance > steepest) steepest = drop / distance;
        }
        const m0 = perMaterial[blocks.material[i] as number];
        if (m0 !== undefined && steepest > 0) {
          const grip =
            fp.dropPinning * sigma * Math.max(0, Math.cos(m0.thetaR) - Math.cos(m0.thetaA));
          if (insideUnderside(i)) {
            const dropWidth = sp.dripDropFactor * capillary;
            const pinned = grip / (g * liquid.rho * fp.undersideHold * dropWidth);
            hold[i] =
              (liquid.rho * area * fp.undersideHold * Math.min(1, pinned / steepest)) / WATER_UNIT;
          } else {
            const pinned = grip / (g * fp.edgeHold);
            hold[i] = (fp.edgeHold * side * Math.min(1, pinned / steepest)) / WATER_UNIT;
          }
        }
      } else if (k === BLOCK_KIND.pit) {
        // What stays on a level face once it has drained is held by the receding contact
        // line at its edge: 2 l_c sin(theta_r / 2), at most `film.puddleDepth`.
        const thetaR = perMaterial[blocks.material[i] as number]?.thetaR ?? Math.PI;
        const depth = Math.min(fp.puddleDepth, 2 * capillary * Math.sin(0.5 * thetaR));
        hold[i] = (liquid.rho * area * depth) / WATER_UNIT;
      }
    }
    if (k !== BLOCK_KIND.sump && k !== BLOCK_KIND.basin) {
      // The meniscus of a contact and the half of a liquid-filled gap are one body of water.
      hold[i] = Math.round(
        (hold[i] as number) + Math.max(bridge[i] as number, reservoir[i] as number),
      );
    } else {
      hold[i] = 0;
      reservoir[i] = 0;
    }
    run[i] = line[i] === 1 ? (width[i] as number) : area / (width[i] as number);
    tauCoef[i] = (along * WATER_UNIT) / area;
    const m = perMaterial[blocks.material[i] as number];
    if (m === undefined) continue;
    // g_e = g max(sin beta, floor)^n_beta; delta* scales as g_e^(-2/5).
    const scale = fp.nBeta === 0 ? 1 : Math.pow(sinBeta, -fp.deltaStarGravityExp * fp.nBeta);
    const ge = fp.nBeta === 0 ? g : g * Math.pow(sinBeta, fp.nBeta);
    const deltaA = m.deltaA * scale;
    const deltaR = m.deltaR * scale;
    const perMetre = (liquid.rho * area) / WATER_UNIT; // units per metre of thickness
    mWet[i] = fp.kappaW * deltaA * perMetre;
    bMax[i] = (m.bMax / sinBeta) * perMetre;
    mDry[i] = fp.deltaDry * perMetre;
    gammaA[i] = (liquid.rho * liquid.rho * ge * deltaA * deltaA * deltaA) / (3 * liquid.mu);
    gammaR[i] = (liquid.rho * liquid.rho * ge * deltaR * deltaR * deltaR) / (3 * liquid.mu);
    // The dewetting time grows without bound as the receding angle comes down to
    // `film.thetaFilm`: no cliff at the threshold.
    if (line[i] === 0 && m.ramp > 0 && m.dewet > 0) {
      tDw[i] = side / (m.dewet * m.ramp);
      ramp[i] = m.ramp;
    }
  }

  // Where a full basin spills to: a block outside the cavity, so that the overflow does not
  // run straight back in over the inner side of the crest.
  const basinOutlet = new Int32Array(scene.basins.length).fill(-1);
  scene.basins.forEach((basin, k) => {
    const start = basin.spillBlock;
    if (start === SCENE_NONE || start >= n) return;
    const seen = new Set<number>([start]);
    let ring = [start];
    for (let depth = 0; depth < CASCADE_NUMERICS.outletReach && ring.length > 0; depth++) {
      const next: number[] = [];
      for (const b of ring) {
        const side = Math.sqrt(blocks.area[b] as number);
        if (
          basinOf[b] !== k &&
          (centre[3 * b + 2] as number) < basin.spillLevel - CASCADE_NUMERICS.pitLevel * side
        ) {
          basinOutlet[k] = b;
          return;
        }
        for (let e2 = graph.offsets[b] as number; e2 < (graph.offsets[b + 1] as number); e2++) {
          const j = graph.neighbour[e2] as number;
          if (!seen.has(j)) {
            seen.add(j);
            next.push(j);
          }
        }
      }
      ring = next;
    }
  });

  const order = Uint32Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => (centre[3 * b + 2] as number) - (centre[3 * a + 2] as number) || a - b,
  );

  return {
    liquid,
    kind,
    recvOffsets,
    recvBlock: Uint32Array.from(recvBlock),
    recvWeight: Uint32Array.from(recvWeight),
    dripRow,
    basinOf,
    line,
    lam,
    turb,
    turbFrom,
    turbExp,
    hold,
    width,
    run,
    gap,
    reservoir,
    tauCoef,
    mWet,
    bMax,
    mDry,
    gammaA,
    gammaR,
    tDw,
    ramp,
    order,
    basinOutlet,
  };
}

/** What feeds the cascade over one revolution of the master arm. */
export interface CascadeFeed {
  /** Time of one revolution, s, and steps (phase bins) per revolution. */
  readonly period: number;
  readonly steps: number;
  /** The hand-over of the jets by phase bin (its `bins` must equal `steps`). */
  readonly handover?: JetHandover | undefined;
  /** Airborne water per block and revolution, whole units (sparse, ascending by block). */
  readonly air?: { readonly block: Uint32Array; readonly mass: Float64Array } | undefined;
  /** The landing table of the drip sites; without it a drop lands on the scene's drip target. */
  readonly drips?: DripTransfer | undefined;
}

/** How long the cascade is marched. */
export interface CascadePlan {
  readonly settleRevolutions: number;
  readonly recordRevolutions: number;
}

/** What the cascade found, in units and seconds. */
export interface CascadeResult {
  /** Steps recorded and the time they span, s. */
  readonly recordedSteps: number;
  readonly recordedTime: number;
  /**
   * Per block, over the recorded revolutions: sum of the wetted share, number of steps in the
   * film or rivulet regime, sum over those steps of the flowing units over f (what the block
   * holds back left out), units out and units in (`airSum`: the part of them that came out of
   * the air, from jets and droplets); sum of all the units on the block (film, held water,
   * beads) and number of steps with any.
   */
  readonly wetSum: Float32Array;
  readonly flowSteps: Float32Array;
  readonly massSum: Float64Array;
  readonly outSum: Float64Array;
  readonly inSum: Float64Array;
  readonly airSum: Float64Array;
  readonly totalSum: Float64Array;
  readonly timeSteps: Float32Array;
  /**
   * Per block: mean time since the water on it left the air, seconds, in the steady state of
   * the mean flows of the recorded revolutions (see the file comment, "age"). Infinity for a
   * block whose water nothing replaces, 0 for a block without water.
   */
  readonly age: Float32Array;
  /**
   * Flux-weighted mean age of the water that returns to the sump, seconds: the time water
   * spends on the surfaces between landing and the sump (its flight is not in it). 0 when none
   * returns.
   */
  readonly returnAge: number;
  /** Units that entered each basin over the recorded revolutions. */
  readonly basinIn: Float64Array;
  /** Per block after the drain-down: units left (film and beads), and the time it stayed wet, s. */
  readonly retained: Float64Array;
  readonly holdTime: Float32Array;
  /**
   * Units fed in, made up during the pilot (the water blocks hold back, see `primed` in the
   * march), returned to the sump and held on the surfaces at the end of the recorded
   * revolutions: `fed + primed = toSump + stored`, exactly.
   */
  readonly fed: number;
  readonly primed: number;
  readonly toSump: number;
  readonly stored: number;
  /** Units returned to the sump, and the change of the units held, in the last recorded revolution. */
  readonly sumpLastRevolution: number;
  readonly storedChange: number;
  /** Units fed per revolution. */
  readonly fedPerRevolution: number;
  /** Area share of blocks whose wetted share changed by more than 0.1 between the last two recorded revolutions. */
  readonly wetChange: number;
  /** Units held on each block at the end of the recorded revolutions (film and beads). */
  readonly held: Float64Array;
  /**
   * Units on their way at that moment: handed to a block that had already been visited in the
   * last step (across a puddle, over the rim of a basin, up a contact). Part of `stored`.
   */
  readonly inTransit: number;
  /** Units returned to the sump and still held at the end of the drain-down. */
  readonly drainToSump: number;
  readonly drainStored: number;
}

// Packed layouts of the march. The loop over the blocks is bound by memory traffic, so what one
// block needs lies together: the parameters (PRM), the state (STA) and the statistics (REC),
// all in the order in which the blocks are visited (`CascadeStatic.order`).
const PRM = 14;
const P_LAM = 0;
const P_TURB = 1;
const P_TURB_FROM = 2;
const P_HOLD = 3;
const P_WIDTH = 4;
/** Units at delta_wet (the onset of a film from beads) and at delta*_a (a full-width film). */
const P_WET = 5;
const P_STAR = 6;
const P_BEAD = 7;
const P_DRY = 8;
const P_GAMMA_A = 9;
const P_GAMMA_R = 10;
const P_DEWET = 11;
/** kind + 8 x line + 16 x (the receivers take the whole outflow). */
const P_CODE = 12;
/** 1 - ramp of the material: the wetted share a rivulet has at least. */
const P_FLOOR = 13;
const STA = 8;
const S_M = 0;
const S_B = 1;
const S_FRAC = 2;
/** Film: time its loading has been below Gamma*_r. Rivulet: time its thread has been thinner than delta_wet. */
const S_LOW = 3;
const S_REGIME = 4;
const S_AIR_BASE = 5;
const S_AIR_REST = 6;
/** 1: what the block holds back has been made up; 2: wet when the sprays stopped. */
const S_FLAGS = 7;
const REC = 9;
const R_WET = 0;
const R_FLOW = 1;
const R_MASS = 2;
const R_OUT = 3;
const R_IN = 4;
const R_HOLD = 5;
/** Sum of all the units on the block (film, held water and beads), and steps with any. */
const R_TOTAL = 6;
const R_TIME = 7;
/** Units taken in from the air alone (jets and droplets), part of R_IN. */
const R_AIR = 8;

/**
 * Marches the cascade: pilot, settle and recorded revolutions under the periodic forcing, then
 * the drain-down. `st` must be the static tables of `scene`.
 *
 * A step visits the blocks from the highest to the lowest and hands what a block passes on to
 * its receivers at once, so that water moving downhill is treated implicitly along its whole
 * path (the speed of a front is not limited to a block per step); what goes to a block that
 * has already been visited (across a level puddle, over the rim of a basin) arrives in the
 * next step.
 */
export function marchCascade(
  scene: WashScene,
  st: CascadeStatic,
  fp: FilmParams,
  feed: CascadeFeed,
  plan: CascadePlan,
): CascadeResult {
  const n = scene.blocks.count;
  const steps = Math.max(1, Math.round(feed.steps));
  const dt0 = feed.period / steps;
  const handover = feed.handover;
  if (handover !== undefined && handover.bins !== steps) {
    throw new RangeError(`marchCascade: ${handover.bins} hand-over bins for ${steps} steps`);
  }
  const drips = feed.drips;
  const sceneDrips = scene.drips;
  const p = st.turbExp;
  const fMin = fp.rivuletMin;
  const f1 = fp.rivuletF1;
  const beadCover = fp.beadCover;
  const dewetBeadShare = fp.dewetBeadShare;
  const newton = CASCADE_NUMERICS.newton;
  const area = scene.blocks.area;

  // Position of every block in the order of the visit.
  const order = st.order;
  const posOf = new Uint32Array(n);
  for (let pos = 0; pos < n; pos++) posOf[order[pos] as number] = pos;

  // Parameters, packed by position; receivers as (position, weight) pairs.
  const prm = new Float64Array(PRM * n);
  const offsets = new Uint32Array(n + 1);
  const pairs = new Uint32Array(2 * st.recvBlock.length);
  /** Row of the drip table of a drip site, basin of a basin sink. */
  const aux = new Int32Array(n).fill(-1);
  let filled = 0;
  for (let pos = 0; pos < n; pos++) {
    const i = order[pos] as number;
    const o = PRM * pos;
    prm[o + P_LAM] = st.lam[i] as number;
    prm[o + P_TURB] = st.turb[i] as number;
    prm[o + P_TURB_FROM] = st.turbFrom[i] as number;
    prm[o + P_HOLD] = st.hold[i] as number;
    prm[o + P_WIDTH] = st.width[i] as number;
    prm[o + P_WET] = st.mWet[i] as number;
    prm[o + P_STAR] = fp.kappaW > 0 ? (st.mWet[i] as number) / fp.kappaW : Infinity;
    prm[o + P_BEAD] = st.bMax[i] as number;
    prm[o + P_DRY] = st.mDry[i] as number;
    prm[o + P_GAMMA_A] = st.gammaA[i] as number;
    prm[o + P_GAMMA_R] = st.gammaR[i] as number;
    prm[o + P_DEWET] = st.tDw[i] as number;
    prm[o + P_FLOOR] = 1 - (st.ramp[i] as number);
    let total = 0;
    for (let e = st.recvOffsets[i] as number; e < (st.recvOffsets[i + 1] as number); e++) {
      pairs[2 * filled] = posOf[st.recvBlock[e] as number] as number;
      pairs[2 * filled + 1] = st.recvWeight[e] as number;
      total += st.recvWeight[e] as number;
      filled++;
    }
    offsets[pos + 1] = filled;
    const k = st.kind[i] as number;
    prm[o + P_CODE] = k + 8 * (st.line[i] as number) + (total === WEIGHT_ONE ? 16 : 0);
    if (k === BLOCK_KIND.drip) aux[pos] = st.dripRow[i] as number;
    else if (k === BLOCK_KIND.basin) aux[pos] = st.basinOf[i] as number;
  }
  // Where drops land, as positions (`n` stands for the sump).
  const landing =
    drips !== undefined
      ? Uint32Array.from(drips.target, (b) => posOf[b] as number)
      : Uint32Array.from(sceneDrips.target, (b) =>
          b === DRIP_TO_FLOOR || b === SCENE_NONE ? n : (posOf[b] as number),
        );
  const spill = scene.basins.map((_, k) => {
    const outlet = st.basinOutlet[k] as number;
    return outlet < 0 ? n : (posOf[outlet] as number);
  });

  // State. Airborne feed per fine step: a whole share and a remainder over the first steps.
  const sta = new Float64Array(STA * n);
  for (let pos = 0; pos < n; pos++) sta[STA * pos + S_FRAC] = 1;
  let airPerRevolution = 0;
  if (feed.air !== undefined) {
    for (let i = 0; i < feed.air.block.length; i++) {
      const so = STA * (posOf[feed.air.block[i] as number] as number);
      const units = feed.air.mass[i] as number;
      const base = Math.floor(units / steps);
      sta[so + S_AIR_BASE] = base;
      sta[so + S_AIR_REST] = units - base * steps;
      airPerRevolution += units;
    }
  }
  let handoverPerRevolution = 0;
  let handoverPos = new Uint32Array(0);
  if (handover !== undefined) {
    handoverPos = Uint32Array.from(handover.block, (b) => posOf[b] as number);
    for (let i = 0; i < handover.mass.length; i++)
      handoverPerRevolution += handover.mass[i] as number;
  }
  const rec = new Float64Array(REC * n);
  /** What has arrived at each position and not yet been taken up. */
  const cur = new Float64Array(n);
  const basinNow = new Float64Array(scene.basins.length);
  const basinIn = new Float64Array(scene.basins.length);

  let fed = 0;
  let sump = 0;
  // During the pilot a block that water reaches for the first time has what it holds back
  // (pendant ridge, puddle, bridge) made up at once, from outside the balance: `primed`.
  let priming = false;
  let primed = 0;
  let record = false;
  let draining = false;
  let drainClock = 0;

  /**
   * One step of length `dt` that covers the fine steps `s0 .. s1 - 1` of the revolution. With
   * `scale` above 1 the step stands for that many revolutions: what the fine steps feed is
   * taken that many times (and `dt` is that many times as long).
   */
  const step = (dt: number, s0: number, s1: number, forced: boolean, scale = 1): void => {
    // Everything the loop touches is held in locals: captured variables cost a load each.
    const recording = record;
    const drainEnd = draining ? drainClock + dt : -1;
    const prime = priming;
    const P = prm;
    const S = sta;
    const R = rec;
    let fedL = 0;
    let sumpL = 0;
    let primedL = 0;
    if (forced && handover !== undefined) {
      for (let i = handover.offsets[s0] as number; i < (handover.offsets[s1] as number); i++) {
        const at = handoverPos[i] as number;
        const units = (handover.mass[i] as number) * scale;
        cur[at] = (cur[at] as number) + units;
        fedL += units;
      }
    }
    const span = s1 - s0;
    for (let i = 0; i < n; i++) {
      const so = STA * i;
      const inflow = cur[i] as number;
      let air = 0;
      if (forced) {
        const rest = S[so + S_AIR_REST] as number;
        air =
          ((S[so + S_AIR_BASE] as number) * span + (Math.min(rest, s1) - Math.min(rest, s0))) *
          scale;
      }
      let mi = S[so + S_M] as number;
      let bi = S[so + S_B] as number;
      if (inflow === 0 && air === 0 && mi === 0) {
        if (bi > 0 && recording) {
          const cap = P[PRM * i + P_BEAD] as number;
          R[REC * i + R_WET] =
            (R[REC * i + R_WET] as number) + beadCover * (cap > 0 ? Math.min(1, bi / cap) : 1);
          R[REC * i + R_TOTAL] = (R[REC * i + R_TOTAL] as number) + bi;
          R[REC * i + R_TIME] = (R[REC * i + R_TIME] as number) + 1;
        }
        continue;
      }
      const po = PRM * i;
      const ro = REC * i;
      cur[i] = 0;
      fedL += air;
      if (recording) {
        R[ro + R_IN] = (R[ro + R_IN] as number) + inflow + air;
        R[ro + R_AIR] = (R[ro + R_AIR] as number) + air;
      }
      let reg = S[so + S_REGIME] as number;
      let f = S[so + S_FRAC] as number;
      const code = P[po + P_CODE] as number;
      const k = code & 7;
      const isLine = (code & 8) !== 0;
      let a: number;
      if (reg >= REGIME.rivulet) {
        a = mi + inflow + air;
      } else {
        bi += air;
        const onset = Math.min(P[po + P_WET] as number, P[po + P_BEAD] as number);
        if (inflow > 0 || bi + mi >= onset) {
          a = mi + bi + inflow;
          bi = 0;
          const loading = (inflow * WATER_UNIT) / (dt * (P[po + P_WIDTH] as number));
          const need = P[po + P_GAMMA_A] as number;
          if (
            inflow === 0 ||
            isLine ||
            k !== BLOCK_KIND.normal ||
            loading >= need ||
            (P[po + P_DEWET] as number) === Infinity
          ) {
            // Enough rain, a stream at or above the wetting rate, or a surface that never
            // dewets (the trail of the thinnest stream stays wet on it): a film.
            reg = REGIME.film;
            f = 1;
          } else {
            reg = REGIME.rivulet;
            f = Math.max(fMin, f1 * Math.sqrt(Math.sqrt(loading / need)));
            if (f > 1) f = 1;
            f = 1 - (1 - (P[po + P_FLOOR] as number)) * (1 - f);
          }
          S[so + S_LOW] = 0;
        } else {
          S[so + S_B] = bi;
          S[so + S_REGIME] = bi > 0 ? REGIME.bead : REGIME.dry;
          if (recording && bi > 0) {
            const cap = P[po + P_BEAD] as number;
            R[ro + R_WET] =
              (R[ro + R_WET] as number) + beadCover * (cap > 0 ? Math.min(1, bi / cap) : 1);
            R[ro + R_TOTAL] = (R[ro + R_TOTAL] as number) + bi;
            R[ro + R_TIME] = (R[ro + R_TIME] as number) + 1;
          }
          continue;
        }
      }
      const kept = P[po + P_HOLD] as number;
      if (prime) {
        const flags = S[so + S_FLAGS] as number;
        if ((flags & 1) === 0) {
          S[so + S_FLAGS] = flags | 1;
          a += kept;
          primedL += kept;
        }
      }

      // Outflow.
      let q = 0;
      if (k === BLOCK_KIND.sump || k === BLOCK_KIND.basin) {
        q = a;
      } else {
        const y = a - kept;
        if (y > 0) {
          if (k === BLOCK_KIND.pit) {
            q = y;
          } else if (isLine) {
            const kk = dt * (P[po + P_LAM] as number);
            const left = kk > 0 ? (Math.sqrt(1 + 4 * kk * y) - 1) / (2 * kk) : y;
            q = Math.round(y - left);
          } else {
            const kk = (dt * (P[po + P_LAM] as number)) / (f * f);
            let x = y;
            if (kk > 0) {
              // Newton on x + k x^3 = y from what was held a step ago (in a steady film that
              // is the answer); from any positive start the second iterate lies above the
              // root and the rest descend to it.
              const before = mi - kept;
              if (before > 0 && before < y) x = before;
              else if (kk * y * y > 1) x = Math.cbrt(y / kk);
              for (let it = 0; it < newton; it++) {
                const x2 = x * x;
                x = (2 * kk * x2 * x + y) / (3 * kk * x2 + 1);
              }
              if (x > (P[po + P_TURB_FROM] as number) * f) {
                // The turbulent branch carries less: x + k_t x^p = y.
                const kt = (dt * (P[po + P_TURB] as number)) / Math.pow(f, p - 1);
                for (let it = 0; it < newton; it++) {
                  const xp = Math.pow(x, p - 1);
                  x = ((p - 1) * kt * xp * x + y) / (p * kt * xp + 1);
                }
              }
            }
            q = Math.round(y - x);
          }
          if (q < 0) q = 0;
          else if (q > y) q = y;
        }
      }
      mi = a - q;

      // Regime.
      if (k === BLOCK_KIND.normal && !isLine) {
        const loading = (q * WATER_UNIT) / (dt * (P[po + P_WIDTH] as number));
        const patience = P[po + P_DEWET] as number;
        if (reg === REGIME.rivulet) {
          const need = P[po + P_GAMMA_A] as number;
          // What the block holds back (ridge, puddle, bridge) does not spread a stream.
          if (loading >= need || mi - kept > (P[po + P_STAR] as number)) {
            reg = REGIME.film;
            f = 1;
            S[so + S_LOW] = 0;
            // The film takes up the drops that stood beside the stream.
            mi += bi;
            bi = 0;
          } else {
            f = Math.max(fMin, f1 * Math.sqrt(Math.sqrt(loading / need)));
            if (f > 1) f = 1;
            f = 1 - (1 - (P[po + P_FLOOR] as number)) * (1 - f);
            // A thread thinner than the wetting thickness cannot hold its contact lines: on a
            // material that dewets it breaks into beads once they have had time to recede; on
            // any material, once it has run out.
            const thread = mi / f;
            const thin = thread < (P[po + P_WET] as number) ? (S[so + S_LOW] as number) + dt : 0;
            S[so + S_LOW] = thin;
            if (
              thin >= patience ||
              (inflow === 0 && air === 0 && thread < (P[po + P_DRY] as number))
            ) {
              bi += mi;
              mi = 0;
              reg = bi > 0 ? REGIME.bead : REGIME.dry;
            }
          }
        } else if (patience < Infinity) {
          if (loading < (P[po + P_GAMMA_R] as number)) {
            const waited = (S[so + S_LOW] as number) + dt;
            if (waited >= patience) {
              reg = REGIME.rivulet;
              f = Math.max(
                fMin,
                f1 * Math.sqrt(Math.sqrt(loading / (P[po + P_GAMMA_A] as number))),
              );
              if (f > 1) f = 1;
              f = 1 - (1 - (P[po + P_FLOOR] as number)) * (1 - f);
              S[so + S_LOW] = 0;
              // The film that breaks up leaves drops on the part it uncovers (films 8.2): up
              // to a share of the bead capacity, out of the water that was flowing.
              const room = dewetBeadShare * (P[po + P_BEAD] as number) * (1 - f) - bi;
              const free = mi - kept;
              if (room >= 1 && free >= 1) {
                const left = Math.floor(Math.min(room, free));
                bi += left;
                mi -= left;
              }
            } else {
              S[so + S_LOW] = waited;
            }
          } else {
            S[so + S_LOW] = 0;
          }
        }
      }
      S[so + S_M] = mi;
      S[so + S_B] = bi;
      S[so + S_REGIME] = reg;
      S[so + S_FRAC] = f;

      // Statistics.
      if (recording) {
        R[ro + R_OUT] = (R[ro + R_OUT] as number) + q;
        if (reg >= REGIME.rivulet) {
          // Beside a rivulet, the drops a film left behind cover part of what is not wetted.
          let cover = f;
          if (bi > 0) {
            const cap = P[po + P_BEAD] as number;
            cover += (1 - f) * beadCover * (cap > 0 ? Math.min(1, bi / cap) : 1);
          }
          R[ro + R_WET] = (R[ro + R_WET] as number) + cover;
          R[ro + R_FLOW] = (R[ro + R_FLOW] as number) + 1;
          // Thickness and shear are those of the water that flows: what the block holds back
          // (pendant ridge, puddle, bridge) stands still and is reported as retained only.
          if (mi > kept) R[ro + R_MASS] = (R[ro + R_MASS] as number) + (mi - kept) / f;
          R[ro + R_TOTAL] = (R[ro + R_TOTAL] as number) + mi + bi;
          R[ro + R_TIME] = (R[ro + R_TIME] as number) + 1;
        } else if (bi > 0) {
          const cap = P[po + P_BEAD] as number;
          R[ro + R_WET] =
            (R[ro + R_WET] as number) + beadCover * (cap > 0 ? Math.min(1, bi / cap) : 1);
          R[ro + R_TOTAL] = (R[ro + R_TOTAL] as number) + bi;
          R[ro + R_TIME] = (R[ro + R_TIME] as number) + 1;
        }
      } else if (drainEnd >= 0 && ((S[so + S_FLAGS] as number) & 2) !== 0) {
        // Still wet: a film or rivulet thicker than the dry limit.
        if (reg >= REGIME.rivulet && mi / f >= (P[po + P_DRY] as number)) R[ro + R_HOLD] = drainEnd;
      }
      if (q === 0) continue;

      // Routing.
      let rest = q;
      const from = offsets[i] as number;
      const to = offsets[i + 1] as number;
      for (let e = from; e < to; e++) {
        const share = Math.floor((q * (pairs[2 * e + 1] as number)) / WEIGHT_ONE);
        if (share === 0) continue;
        const target = pairs[2 * e] as number;
        cur[target] = (cur[target] as number) + share;
        rest -= share;
      }
      if (rest === 0) continue;
      if (k === BLOCK_KIND.normal || k === BLOCK_KIND.pit) {
        // The rounding goes with the last receiver (a graph receiver where there is one); a
        // puddle with no way off its face returns what it spills to the sump.
        if (to > from && (code & 16) !== 0) {
          const target = pairs[2 * (to - 1)] as number;
          cur[target] = (cur[target] as number) + rest;
        } else {
          sumpL += rest;
        }
      } else if (k === BLOCK_KIND.drip) {
        const row = aux[i] as number;
        if (drips !== undefined) {
          let left = rest;
          for (let e = drips.offsets[row] as number; e < (drips.offsets[row + 1] as number); e++) {
            const share = Math.floor((rest * (drips.weight[e] as number)) / DRIP_WEIGHT_ONE);
            if (share === 0) continue;
            const target = landing[e] as number;
            cur[target] = (cur[target] as number) + share;
            left -= share;
          }
          // What the table sends to the sump, and the rounding.
          sumpL += left;
        } else {
          const target = landing[row] as number;
          if (target >= n) sumpL += rest;
          else cur[target] = (cur[target] as number) + rest;
        }
      } else if (k === BLOCK_KIND.basin) {
        const basin = aux[i] as number;
        basinNow[basin] = (basinNow[basin] as number) + rest;
      } else {
        sumpL += rest;
      }
    }
    // Basins are full: what entered spills at the spill block.
    for (let k = 0; k < basinNow.length; k++) {
      const units = basinNow[k] as number;
      if (units === 0) continue;
      basinNow[k] = 0;
      if (recording) basinIn[k] = (basinIn[k] as number) + units;
      const target = spill[k] as number;
      if (target >= n) sumpL += units;
      else cur[target] = (cur[target] as number) + units;
    }
    fed += fedL;
    sump += sumpL;
    primed += primedL;
  };

  const storedNow = (): number => {
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += (sta[STA * i + S_M] as number) + (sta[STA * i + S_B] as number) + (cur[i] as number);
    }
    return total;
  };

  // Soak: long steps with the time-mean forcing, which land near the steady state of the
  // slow thin films. Then the pilot: whole revolutions at a coarse step.
  const coarse = Math.min(steps, fp.pilotCoarsening);
  priming = true;
  if (fp.soakRevolutions >= 1) {
    for (let k = 0; k < fp.soakSteps; k++) {
      step(feed.period * fp.soakRevolutions, 0, steps, true, fp.soakRevolutions);
    }
  }
  for (let r = 0; r < fp.pilotRevolutions; r++) {
    for (let s = 0; s < steps; s += coarse) {
      const s1 = Math.min(steps, s + coarse);
      step(dt0 * (s1 - s), s, s1, true);
    }
  }
  priming = false;
  for (let r = 0; r < plan.settleRevolutions; r++) {
    for (let s = 0; s < steps; s++) step(dt0, s, s + 1, true);
  }
  let sumpBefore = sump;
  let storedBefore = storedNow();
  let sumpLastRevolution = 0;
  let storedChange = 0;
  record = true;
  const recordRevolutions = Math.max(1, plan.recordRevolutions);
  const wetFirst = new Float32Array(n);
  for (let r = 0; r < recordRevolutions; r++) {
    if (r === recordRevolutions - 1) {
      for (let i = 0; i < n; i++) wetFirst[i] = rec[REC * i + R_WET] as number;
    }
    for (let s = 0; s < steps; s++) step(dt0, s, s + 1, true);
    const stored = storedNow();
    sumpLastRevolution = sump - sumpBefore;
    storedChange = stored - storedBefore;
    sumpBefore = sump;
    storedBefore = stored;
  }
  record = false;

  const wetSum = new Float32Array(n);
  const flowSteps = new Float32Array(n);
  const massSum = new Float64Array(n);
  const outSum = new Float64Array(n);
  const inSum = new Float64Array(n);
  const airSum = new Float64Array(n);
  const totalSum = new Float64Array(n);
  const timeSteps = new Float32Array(n);
  const held = new Float64Array(n);
  // Change of the wetted share between the last two recorded revolutions.
  let changed = 0;
  let totalArea = 0;
  for (let pos = 0; pos < n; pos++) {
    const i = order[pos] as number;
    wetSum[i] = rec[REC * pos + R_WET] as number;
    flowSteps[i] = rec[REC * pos + R_FLOW] as number;
    massSum[i] = rec[REC * pos + R_MASS] as number;
    outSum[i] = rec[REC * pos + R_OUT] as number;
    inSum[i] = rec[REC * pos + R_IN] as number;
    airSum[i] = rec[REC * pos + R_AIR] as number;
    totalSum[i] = rec[REC * pos + R_TOTAL] as number;
    timeSteps[i] = rec[REC * pos + R_TIME] as number;
    held[i] = (sta[STA * pos + S_M] as number) + (sta[STA * pos + S_B] as number);
    const a = area[i] as number;
    totalArea += a;
    if (recordRevolutions < 2) continue;
    const last = ((rec[REC * pos + R_WET] as number) - (wetFirst[pos] as number)) / steps;
    const before = (wetFirst[pos] as number) / (steps * (recordRevolutions - 1));
    // literal-ok-begin: arithmetic control (a share used in a rule of the grid, not a physical quantity)
    if (Math.abs(last - before) > 0.1) changed += a;
    // literal-ok-end
  }
  const stored = storedBefore;
  const toSump = sump;
  let inTransit = 0;
  for (let pos = 0; pos < n; pos++) inTransit += cur[pos] as number;

  // The age of the water on every block, in the steady state of the recorded mean flows: a
  // block is a stirred store, so what leaves it is as old as what entered it (flux-weighted;
  // water from the air is new) plus the water on it over its throughput. Blocks are taken from
  // the highest down, so a sweep is exact wherever water only runs to blocks further on; what
  // goes back up the order (across a puddle, out of a basin) is carried by the next sweep.
  const age = new Float32Array(n);
  let sumpUnits = 0;
  let sumpAge = 0;
  {
    const recordedSteps = recordRevolutions * steps;
    const recordedTime = recordRevolutions * feed.period;
    const ageOut = new Float64Array(n);
    // Sum over the inflows of a position of units times age: from blocks before it in this
    // sweep, and (`late`) from blocks after it in the sweep before.
    let early = new Float64Array(n);
    let late = new Float64Array(n);
    const basinUnits = new Float64Array(scene.basins.length);
    const basinAge = new Float64Array(scene.basins.length);
    for (let sweep = 0; sweep < CASCADE_NUMERICS.ageSweeps; sweep++) {
      const swap = early;
      early = late;
      late = swap;
      late.fill(0);
      basinUnits.fill(0);
      basinAge.fill(0);
      sumpUnits = 0;
      sumpAge = 0;
      for (let i = 0; i < n; i++) {
        const ro = REC * i;
        const out = rec[ro + R_OUT] as number;
        const taken = rec[ro + R_IN] as number;
        const total = rec[ro + R_TOTAL] as number;
        const code = prm[PRM * i + P_CODE] as number;
        const k = code & 7;
        if (k === BLOCK_KIND.sump) {
          // What reaches the tub floor or an arm is back in the sump, as old as it arrives.
          sumpUnits += taken;
          sumpAge += early[i] as number;
          continue;
        }
        const through = Math.max(out, taken);
        let a = taken > 0 ? (early[i] as number) / taken : 0;
        if (k !== BLOCK_KIND.basin) {
          if (!(total > 0)) {
            ageOut[i] = 0;
            if (!(out > 0)) continue;
          } else if (through > 0) {
            a += (total / recordedSteps / through) * recordedTime;
          } else {
            a = Infinity;
          }
        }
        ageOut[i] = a;
        if (!(out > 0) || a === Infinity) continue;
        let rest = out;
        const from = offsets[i] as number;
        const to = offsets[i + 1] as number;
        for (let e = from; e < to; e++) {
          const share = (out * (pairs[2 * e + 1] as number)) / WEIGHT_ONE;
          if (!(share > 0)) continue;
          const target = pairs[2 * e] as number;
          if (target > i) early[target] = (early[target] as number) + share * a;
          else late[target] = (late[target] as number) + share * a;
          rest -= share;
        }
        // literal-ok-begin: arithmetic tolerance
        if (!(rest > 1e-9 * out)) continue;
        // literal-ok-end
        if (k === BLOCK_KIND.drip) {
          const row = aux[i] as number;
          let fallen = rest;
          if (drips !== undefined) {
            for (
              let e = drips.offsets[row] as number;
              e < (drips.offsets[row + 1] as number);
              e++
            ) {
              const share = (rest * (drips.weight[e] as number)) / DRIP_WEIGHT_ONE;
              const target = landing[e] as number;
              if (target >= n) continue;
              if (target > i) early[target] = (early[target] as number) + share * a;
              else late[target] = (late[target] as number) + share * a;
              fallen -= share;
            }
          } else {
            const target = landing[row] as number;
            if (target < n) {
              if (target > i) early[target] = (early[target] as number) + rest * a;
              else late[target] = (late[target] as number) + rest * a;
              fallen = 0;
            }
          }
          // The drops that land on nothing fall to the sump.
          if (fallen > 0) {
            sumpUnits += fallen;
            sumpAge += fallen * a;
          }
        } else if (k === BLOCK_KIND.basin) {
          const basin = aux[i] as number;
          basinUnits[basin] = (basinUnits[basin] as number) + rest;
          basinAge[basin] = (basinAge[basin] as number) + rest * a;
        } else {
          // A block with no receiver for the whole of its outflow returns the rest to the sump.
          sumpUnits += rest;
          sumpAge += rest * a;
        }
      }
      // A full basin spills what it takes in, older by its volume over its inflow.
      for (let k = 0; k < basinUnits.length; k++) {
        const units = basinUnits[k] as number;
        const target = spill[k] as number;
        if (!(units > 0)) continue;
        const basin = scene.basins[k];
        const volume = basin === undefined ? 0 : basin.volume;
        const stay = ((st.liquid.rho * volume) / (units * WATER_UNIT)) * recordedTime;
        const aged = (basinAge[k] as number) + units * stay;
        if (target >= n) {
          sumpUnits += units;
          sumpAge += aged;
        } else {
          late[target] = (late[target] as number) + aged;
        }
      }
    }
    for (let pos = 0; pos < n; pos++) age[order[pos] as number] = ageOut[pos] as number;
  }

  // Drain-down: the sprays are off.
  for (let pos = 0; pos < n; pos++) {
    const so = STA * pos;
    if (
      (sta[so + S_REGIME] as number) >= REGIME.rivulet &&
      (sta[so + S_M] as number) / (sta[so + S_FRAC] as number) >= (prm[PRM * pos + P_DRY] as number)
    ) {
      sta[so + S_FLAGS] = (sta[so + S_FLAGS] as number) | 2;
    }
  }
  draining = true;
  let dt = dt0;
  while (drainClock < fp.drainTime) {
    const use = Math.min(dt, fp.drainTime - drainClock);
    step(use, 0, 0, false);
    drainClock += use;
    dt = Math.min(fp.drainMaxStep, dt * fp.drainGrowth);
  }
  draining = false;
  const retained = new Float64Array(n);
  const holdTime = new Float32Array(n);
  let drainStored = 0;
  for (let pos = 0; pos < n; pos++) {
    const i = order[pos] as number;
    const so = STA * pos;
    const units = (sta[so + S_M] as number) + (sta[so + S_B] as number);
    retained[i] = units;
    drainStored += units + (cur[pos] as number);
    let hold = rec[REC * pos + R_HOLD] as number;
    // literal-ok-begin: arithmetic tolerance
    if (((sta[so + S_FLAGS] as number) & 2) !== 0 && hold >= fp.drainTime - 1e-9) {
      // literal-ok-end
      // Still a film: it thins as t^(-1/2) (Jeffreys) until it is as thin as the dry limit.
      const ratio =
        (sta[so + S_M] as number) /
        (sta[so + S_FRAC] as number) /
        (prm[PRM * pos + P_DRY] as number);
      hold = Math.min(fp.holdMax, fp.drainTime * Math.max(1, ratio * ratio));
    }
    holdTime[i] = hold;
  }

  return {
    recordedSteps: recordRevolutions * steps,
    recordedTime: recordRevolutions * feed.period,
    wetSum,
    flowSteps,
    massSum,
    outSum,
    inSum,
    airSum,
    totalSum,
    timeSteps,
    age,
    returnAge: sumpUnits > 0 ? sumpAge / sumpUnits : 0,
    basinIn,
    retained,
    holdTime,
    fed,
    primed,
    toSump,
    stored,
    sumpLastRevolution,
    storedChange,
    fedPerRevolution: airPerRevolution + handoverPerRevolution,
    wetChange: totalArea > 0 ? changed / totalArea : 0,
    held,
    inTransit,
    drainToSump: sump - toSump,
    drainStored,
  };
}
