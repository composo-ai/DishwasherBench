/**
 * The loader: authoring definition to specification.
 *
 * `loadMachineSpec` is the one place where the units of a machine description are converted
 * (docs/design/platform.md section 2: authored in millimetres, degrees, litres and minutes,
 * SI internally). It also
 * - moves every basket coordinate from the dossier's basket frame into the platform's rack
 *   frame (origin at the front-left corner of the outer plan rectangle, at the top surface of
 *   the base grid);
 * - derives the area of each nozzle from its shape and size;
 * - orders wire and tine positions ascending;
 * - builds the default configuration from the default states in the definition.
 *
 * It is a pure function and does not judge the data: `validateMachineSpec` does that.
 */

import type { Vec3 } from '@spotless/core';
import {
  degToRad,
  gToKg,
  litresToM3,
  lPerMinToM3PerS,
  minutesToS,
  mlToM3,
  mm2ToM2,
  mmToM,
  rpmToRadPerS,
  v3MmToM,
} from '@spotless/core';
import type {
  BasketDef,
  CornerDef,
  CutleryBasketDef,
  DiverterPatternDef,
  FloorWireFamilyDef,
  MachineDef,
  NozzleDef,
  PrestoreFillDef,
  ProgrammeDef,
  ProgrammeStepDef,
  SprayLevelDef,
  TineRowDef,
} from './def.ts';
import type { PrestoreFill, ProgrammeSpec, ProgrammeStep } from './programme-types.ts';
import { provenanceTagOf } from './provenance.ts';
import type {
  BasketSpec,
  CornerSpec,
  CutleryBasketPlacement,
  CutleryBasketPosition,
  CutleryBasketSpec,
  DiverterPatternSpec,
  FloorWireFamilySpec,
  HorizontalDirection,
  MachineConfig,
  MachineSpec,
  NozzleShape,
  NozzleSpec,
  Range,
  ShelfState,
  SprayLevelSpec,
  TineRowRef,
  TineRowSpec,
  Vec2,
} from './types.ts';

/** Joules in one kilowatt-hour. */
export const JOULES_PER_KWH = 3.6e6;

/** Default time after which a heat step without a fixed duration gives up, minutes. */
export const DEFAULT_HEAT_TIMEOUT_MIN = 120;

const mm = mmToM;
const deg = degToRad;
const litres = litresToM3;

function mmRange(r: Range): Range {
  return [mm(r[0]), mm(r[1])];
}

function mmVec2(v: Vec2): Vec2 {
  return [mm(v[0]), mm(v[1])];
}

function mmOrNull(v: number | null): number | null {
  return v === null ? null : mm(v);
}

/** Square centimetres to square metres. */
function cm2ToM2(cm2: number): number {
  return cm2 / 1e4;
}

/** Kilowatt-hours to joules. */
function kWhToJ(kWh: number): number {
  return kWh * JOULES_PER_KWH;
}

/**
 * Geometric area of a nozzle opening, m^2, from its shape and its size in metres: a circle for
 * a round bore (`[diameter]`), a stadium for a slot (`[length, width]`: a rectangle
 * `width x (length - width)` plus a circle of diameter `width`), a rectangle for `rect`
 * (`[length, width]`). The two sizes of a slot may be given in either order.
 */
export function nozzleArea(shape: NozzleShape, size: readonly number[]): number {
  const a = size[0] ?? 0;
  const b = size[1] ?? a;
  if (shape === 'round') return (Math.PI * a * a) / 4;
  if (shape === 'rect') return a * b;
  const length = Math.max(a, b);
  const width = Math.min(a, b);
  return width * (length - width) + (Math.PI * width * width) / 4;
}

/** A diverter pattern from its `[[position, seconds], ...]` form. */
export function loadDiverterPattern(def: DiverterPatternDef): DiverterPatternSpec {
  return { phases: def.map(([position, duration]) => ({ position, duration })) };
}

function loadCorner(def: CornerDef): CornerSpec {
  if (def.kind === 'round') return { kind: 'round', radius: mm(def.radiusMm) };
  if (def.kind === 'chamfer') return { kind: 'chamfer', dx: mm(def.dxMm), dy: mm(def.dyMm) };
  return { kind: 'square' };
}

function loadNozzle(def: NozzleDef, defaultCv: number): NozzleSpec {
  const size = def.sizeMm.map(mm);
  return {
    id: def.id,
    label: def.label,
    blade: def.blade,
    bladeAssumed: def.bladeAssumed ?? false,
    radius: mm(def.radiusMm),
    theta: deg(def.thetaDeg),
    rho: deg(def.rhoDeg),
    face: def.face,
    shape: def.shape,
    size,
    area: nozzleArea(def.shape, size),
    cd: def.cd,
    cv: def.cv ?? defaultCv,
    drives: def.drives,
    slotAxis: def.shape === 'round' ? null : (def.slotAxis ?? null),
    fan: def.fan === undefined ? null : { angle: deg(def.fan.angleDeg), subJets: def.fan.subJets },
    description: def.description,
  };
}

function loadSprayLevel(def: SprayLevelDef, defaultCv: number): SprayLevelSpec {
  const nozzles = def.nozzles.map((n) => loadNozzle(n, defaultCv));
  if (def.kind === 'fixed') {
    return {
      kind: 'fixed',
      id: def.id,
      name: def.name,
      part: def.part,
      mount: def.mount,
      axis: mmVec2(def.axisMm),
      type: def.type,
      outletZ: mm(def.outletZMm),
      lowerFaceZ: mm(def.lowerFaceZMm),
      diameter: mm(def.diameterMm),
      height: mm(def.heightMm),
      vanes: def.vanes,
      spray: {
        pattern: def.spray.pattern,
        coneHalfAngle: deg(def.spray.coneHalfAngleDeg),
        dropletSpeed: def.spray.dropletSpeed,
      },
      nozzles,
      nozzleProvenance: def.nozzleProvenance,
      provenance: def.provenance,
    };
  }
  return {
    kind: 'arm',
    id: def.id,
    name: def.name,
    part: def.part,
    mount: def.mount,
    axis: mmVec2(def.axisMm),
    tipRadius: mm(def.tipRadiusMm),
    topFaceZ: mm(def.topFaceZMm),
    nozzleUpZ: mmOrNull(def.nozzleUpZMm),
    nozzleDownZ: mmOrNull(def.nozzleDownZMm),
    bladeUndersideZ: mm(def.bladeUndersideZMm),
    hubUndersideZ: mm(def.hubUndersideZMm),
    shape: {
      blades: def.shape.blades,
      bladeThickness: mm(def.shape.bladeThicknessMm),
      hubHeight: mmOrNull(def.shape.hubHeightMm),
      hubDiameter: mmOrNull(def.shape.hubDiameterMm),
      stemDiameter: mmOrNull(def.shape.stemDiameterMm),
      bladeWidth: def.shape.bladeWidthMm === null ? null : mmRange(def.shape.bladeWidthMm),
      tipSweep: deg(def.shape.tipSweepDeg),
      description: def.shape.description,
    },
    feedTube:
      def.feedTubeMm === null
        ? null
        : { length: mm(def.feedTubeMm.length), diameter: mm(def.feedTubeMm.diameter) },
    mass: gToKg(def.massG),
    weight: def.weight,
    inertiaWet: def.inertiaWet,
    sense: def.sense,
    bearing: {
      frictionRadius: mm(def.bearing.frictionRadiusMm),
      viscous: def.bearing.viscous,
      thrustSign: def.bearing.thrustSign,
      hubBore: mm(def.bearing.hubBoreMm),
    },
    designSpeed: def.designSpeedRpm === null ? null : rpmToRadPerS(def.designSpeedRpm),
    nozzles,
    nozzleProvenance: def.nozzleProvenance,
    provenance: def.provenance,
  };
}

/** Converters from a basket's authoring frame (mm) to its rack frame (m). */
interface BasketFrameShift {
  readonly x: (xMm: number) => number;
  readonly y: (yMm: number) => number;
  readonly z: (zMm: number) => number;
}

function shiftOf(def: BasketDef): BasketFrameShift {
  const [x0, y0] = def.local.frontLeftMm;
  const z0 = def.local.gridTopZMm;
  return {
    x: (xMm) => mm(xMm - x0),
    y: (yMm) => mm(yMm - y0),
    z: (zMm) => mm(zMm - z0),
  };
}

function ascending(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function loadFloorFamily(
  def: FloorWireFamilyDef,
  across: (v: number) => number,
  along: (v: number) => number,
  z: (v: number) => number,
): FloorWireFamilySpec {
  const a = along(def.spanMm[0]);
  const b = along(def.spanMm[1]);
  return {
    positions: ascending(def.positionsMm.map(across)),
    pitch: mmOrNull(def.pitchMm),
    z: z(def.zMm),
    span: [Math.min(a, b), Math.max(a, b)],
    humps: def.humps.map((h) => ({
      from: Math.min(along(h.fromMm), along(h.toMm)),
      to: Math.max(along(h.fromMm), along(h.toMm)),
      rise: mm(h.riseMm),
    })),
    crank: mm(def.crankMm),
  };
}

function loadTineRow(def: TineRowDef, shift: BasketFrameShift): TineRowSpec {
  const along = def.runs === 'x' ? shift.x : shift.y;
  const across = def.runs === 'x' ? shift.y : shift.x;
  const leanOf = (i: number): HorizontalDirection => {
    if (typeof def.leanToward === 'string') return def.leanToward;
    const lean = def.leanToward[i];
    if (lean === undefined) {
      throw new RangeError(
        `loadMachineSpec: tine row "${def.id}" has ${def.tinePositionsMm.length} tines but ${def.leanToward.length} lean directions`,
      );
    }
    return lean;
  };
  const tines = def.tinePositionsMm
    .map((p, i) => ({ position: along(p), lean: leanOf(i) }))
    .sort((a, b) => a.position - b.position);
  const s0 = along(def.railSpanMm[0]);
  const s1 = along(def.railSpanMm[1]);
  return {
    id: def.id,
    label: def.label,
    runs: def.runs,
    railAt: across(def.railAtMm),
    railZ: shift.z(def.railZMm),
    railSpan: [Math.min(s0, s1), Math.max(s0, s1)],
    tinePositions: tines.map((t) => t.position),
    leanToward: tines.map((t) => t.lean),
    pitch: mm(def.pitchMm),
    height: mm(def.heightMm),
    lean: deg(def.leanDeg),
    wireDiameter: mm(def.wireDiameterMm),
    tip: def.tip,
    form: def.form,
    hinge:
      def.hinge === null
        ? null
        : {
            foldsToward: def.hinge.foldsToward,
            foldAngle: deg(def.hinge.foldAngleDeg),
            release: def.hinge.release,
          },
    defaultState: def.defaultState,
    provenance: def.provenance,
  };
}

function loadBasket(def: BasketDef): BasketSpec {
  const shift = shiftOf(def);
  const wire = (w: { coatedMm: number; steelMm: number }) => ({
    coated: mm(w.coatedMm),
    steel: mm(w.steelMm),
  });
  return {
    id: def.id,
    level: def.level,
    frame: def.frame,
    kind: def.kind,
    part: def.part,
    material: def.material,
    outline: {
      size: mmVec2(def.outline.sizeMm),
      rimCentres: mmVec2(def.outline.rimCentresMm),
      corners: {
        frontLeft: loadCorner(def.outline.corners.frontLeft),
        frontRight: loadCorner(def.outline.corners.frontRight),
        rearLeft: loadCorner(def.outline.corners.rearLeft),
        rearRight: loadCorner(def.outline.corners.rearRight),
      },
      recesses: def.outline.recesses.map((r) => {
        const along = r.side === 'front' || r.side === 'rear' ? shift.x : shift.y;
        const a = along(r.spanMm[0]);
        const b = along(r.spanMm[1]);
        return {
          side: r.side,
          span: [Math.min(a, b), Math.max(a, b)] as const,
          depth: mm(r.depthMm),
          ramp: mm(r.rampMm),
        };
      }),
    },
    provenance: def.provenance,
    pose: {
      originXY: [
        mm(def.local.originInTubMm[0] + def.local.frontLeftMm[0]),
        mm(def.local.originInTubMm[1] + def.local.frontLeftMm[1]),
      ],
      heightPositions: def.pose.heightPositions.map((p) => ({
        id: p.id,
        label: p.label,
        originZ: mm(p.datumZMm + def.local.gridTopZMm),
      })),
      canTilt: def.pose.canTilt,
      travelDirection: def.pose.travelDirection,
      travel: mm(def.pose.travelMm),
      provenance: def.pose.provenance,
    },
    wires: {
      rim: wire(def.wires.rim),
      floor: wire(def.wires.floor),
      tine: wire(def.wires.tine),
      coating: mm(def.wires.coatingMm),
      provenance: def.wires.provenance,
    },
    walls: def.walls.map((w) => ({
      side: w.side,
      horizontalWireZ: ascending(w.horizontalWireZMm.map(shift.z)),
      uprights: ascending(
        w.uprightsMm.map(w.side === 'front' || w.side === 'rear' ? shift.x : shift.y),
      ),
    })),
    floor: {
      alongY: loadFloorFamily(def.floor.alongY, shift.x, shift.y, shift.z),
      alongX: loadFloorFamily(def.floor.alongX, shift.y, shift.x, shift.z),
      upperLayer: def.floor.upperLayer,
      relief:
        def.floor.relief === undefined
          ? null
          : {
              axis: def.floor.relief.axis,
              points: def.floor.relief.pointsMm
                .map(([at, rise]) => ({
                  at: (def.floor.relief?.axis === 'x' ? shift.x : shift.y)(at),
                  rise: mm(rise),
                }))
                .sort((a, b) => a.at - b.at),
            },
      largestOpening: mmVec2(def.floor.largestOpeningMm),
      provenance: def.floor.provenance,
    },
    tineRows: def.tineRows.map((r) => loadTineRow(r, shift)),
    wheels:
      def.wheels === null
        ? null
        : {
            count: def.wheels.count,
            diameter: mm(def.wheels.diameterMm),
            stationsY: ascending(def.wheels.stationsYMm.map(shift.y)),
            track: mm(def.wheels.trackMm),
            axleZ: shift.z(def.wheels.axleZMm),
            provenance: def.wheels.provenance,
          },
    handle:
      def.handle === null
        ? null
        : {
            part: def.handle.part,
            size: v3MmToM(def.handle.sizeMm),
            centreX: shift.x(def.handle.centreXMm),
            provenance: def.handle.provenance,
          },
    tabletTray:
      def.tabletTray === null
        ? null
        : {
            part: def.tabletTray.part,
            size: v3MmToM(def.tabletTray.sizeMm),
            centre: [shift.x(def.tabletTray.centreMm[0]), shift.y(def.tabletTray.centreMm[1])],
            rimZ: shift.z(def.tabletTray.rimZMm),
            ...(def.tabletTray.frontRimZMm === undefined
              ? {}
              : { frontRimZ: shift.z(def.tabletTray.frontRimZMm) }),
            slotted: def.tabletTray.slotted,
            provenance: def.tabletTray.provenance,
          },
    cupShelves: def.cupShelves.map((s) => {
      const a = shift.y(s.yMm[0]);
      const b = shift.y(s.yMm[1]);
      return {
        id: s.id,
        part: s.part,
        side: s.side,
        size: v3MmToM(s.sizeMm),
        y: [Math.min(a, b), Math.max(a, b)] as const,
        heightAboveGrid: shift.z(s.shelfZMm),
        ...(s.pivotInsetMm === undefined ? {} : { pivotInset: mm(s.pivotInsetMm) }),
        stemwareNotches: s.stemwareNotches,
        defaultState: s.defaultState,
        provenance: s.provenance,
      };
    }),
    holders: def.holders.map((h) => ({
      id: h.id,
      kind: h.kind,
      part: h.part,
      description: h.description,
      side: h.side,
      size: v3MmToM(h.sizeMm),
      x: [shift.x(h.xMm[0]), shift.x(h.xMm[1])] as const,
      y: [shift.y(h.yMm[0]), shift.y(h.yMm[1])] as const,
      floorZ: h.floorZMm === null ? null : shift.z(h.floorZMm),
      ...(h.foldHingeZMm === undefined ? {} : { foldHingeZ: shift.z(h.foldHingeZMm) }),
      mass: gToKg(h.massG),
      folds: h.folds,
      defaultState: h.defaultState,
      provenance: h.provenance,
    })),
    tray:
      def.tray === null
        ? null
        : {
            sideDepth: mm(def.tray.sideDepthMm),
            centreDepth: mm(def.tray.centreDepthMm),
            centreTilt: deg(def.tray.centreTiltDeg),
            combGaps: def.tray.combGapsMm.map(mm),
          },
    mass: def.massKg,
    limits:
      def.limits === null
        ? null
        : {
            maxDiameterByPosition: Object.fromEntries(
              Object.keys(def.limits.maxDiameterByPositionMm)
                .sort()
                .map((k) => [k, mm(def.limits?.maxDiameterByPositionMm[k] ?? 0)]),
            ),
            positionOfBasket: def.limits.positionOfBasket,
            maxDiameterAsShown:
              def.limits.maxDiameterAsShown === null
                ? null
                : {
                    diameter: mm(def.limits.maxDiameterAsShown.diameterMm),
                    positionId: def.limits.maxDiameterAsShown.positionId,
                    where: def.limits.maxDiameterAsShown.where,
                  },
            seating: def.limits.seating.map((s) => ({
              where: s.where,
              maxDiameter: mm(s.maxDiameterMm),
            })),
            provenance: def.limits.provenance,
          },
  };
}

function loadCutleryBasket(
  def: CutleryBasketDef,
  baskets: readonly BasketDef[],
): CutleryBasketSpec {
  const host = baskets.find((b) => b.id === def.defaultPlacement.basketId);
  if (host === undefined) {
    throw new RangeError(
      `loadMachineSpec: the cutlery basket stands in basket "${def.defaultPlacement.basketId}", which the machine does not have`,
    );
  }
  const shift = shiftOf(host);
  const defaultPlacement: CutleryBasketPlacement = {
    basketId: def.defaultPlacement.basketId,
    centre: [shift.x(def.defaultPlacement.centreMm[0]), shift.y(def.defaultPlacement.centreMm[1])],
    longAxis: def.defaultPlacement.longAxis,
  };
  const positions: CutleryBasketPosition[] = [
    {
      id: def.defaultPosition?.id ?? 'default',
      label: def.defaultPosition?.label ?? 'default',
      placement: defaultPlacement,
      tag: provenanceTagOf(def.provenance, 'defaultPlacement'),
      note: def.defaultPosition?.note ?? def.locatedBy,
    },
  ];
  for (const position of def.positions ?? []) {
    const basket = baskets.find((b) => b.id === position.basketId);
    if (basket === undefined) {
      throw new RangeError(
        `loadMachineSpec: cutlery basket position "${position.id}" is in basket "${position.basketId}", which the machine does not have`,
      );
    }
    const to = shiftOf(basket);
    positions.push({
      id: position.id,
      label: position.label,
      placement: {
        basketId: position.basketId,
        centre: [to.x(position.centreMm[0]), to.y(position.centreMm[1])],
        longAxis: position.longAxis,
      },
      tag: position.tag,
      note: position.note,
    });
  }
  return {
    part: def.part,
    material: def.material,
    size: v3MmToM(def.sizeMm),
    widthOverLids: mm(def.widthOverLidsMm),
    heightWithHandle: mm(def.heightWithHandleMm),
    mass: gToKg(def.massG),
    cells: def.cells,
    cellGrid: def.cellGrid,
    sectionsAlongLength: def.sectionsAlongLengthMm.map(mm),
    layout: def.layout,
    base: def.base,
    tunnels:
      def.tunnels === null
        ? null
        : {
            count: def.tunnels.count,
            centresFromMid: def.tunnels.centresFromMidMm.map(mm),
            clearWidth: mm(def.tunnels.clearWidthMm),
            height: mm(def.tunnels.heightMm),
          },
    wallOpening: mmVec2(def.wallOpeningMm),
    floorSlot: mmVec2(def.floorSlotMm),
    lid: def.lid === null ? null : { openings: mmVec2(def.lid.openingsMm), inUse: def.lid.inUse },
    defaultPlacement,
    positions,
    locatedBy: def.locatedBy,
    provenance: def.provenance,
  };
}

function loadPrestoreFills(defs: readonly PrestoreFillDef[] | undefined): PrestoreFill[] {
  return (defs ?? []).map((f) =>
    f.atFraction !== undefined
      ? { at: f.atFraction, relative: true, volume: litres(f.volumeL) }
      : { at: minutesToS(f.atMin ?? 0), volume: litres(f.volumeL) },
  );
}

function loadStep(def: ProgrammeStepDef): ProgrammeStep {
  const base = { id: def.id, row: def.row, phase: def.phase, label: def.label };
  switch (def.kind) {
    case 'drain':
      return {
        ...base,
        kind: 'drain',
        duration: minutesToS(def.durationMin),
        volume: def.volumeL === undefined ? null : litres(def.volumeL),
        filterFlush: def.filterFlush ?? false,
      };
    case 'fill':
      return {
        ...base,
        kind: 'fill',
        duration: def.durationMin === undefined ? null : minutesToS(def.durationMin),
        sources: def.sources.map((s) => ({ from: s.from, volume: litres(s.volumeL) })),
        prestoreFills: loadPrestoreFills(def.prestoreFills),
      };
    case 'circulate':
      return {
        ...base,
        kind: 'circulate',
        duration: minutesToS(def.durationMin),
        pumpRpm: def.pumpRpm,
        diverter: def.diverter === undefined ? null : loadDiverterPattern(def.diverter),
        pulse: def.pulse ?? null,
        prestoreFills: loadPrestoreFills(def.prestoreFills),
      };
    case 'heat':
      return {
        ...base,
        kind: 'heat',
        target: def.target,
        duration: def.durationMin === undefined ? null : minutesToS(def.durationMin),
        timeout: minutesToS(def.timeoutMin ?? DEFAULT_HEAT_TIMEOUT_MIN),
        pumpRpm: def.pumpRpm,
        diverter: def.diverter === undefined ? null : loadDiverterPattern(def.diverter),
        pulse: def.pulse ?? null,
        prestoreFills: loadPrestoreFills(def.prestoreFills),
      };
    case 'hold':
      return {
        ...base,
        kind: 'hold',
        duration: minutesToS(def.durationMin),
        target: def.target ?? null,
        reheatBand: def.reheatBand ?? null,
        pumpRpm: def.pumpRpm,
        diverter: def.diverter === undefined ? null : loadDiverterPattern(def.diverter),
        pulse: def.pulse ?? null,
        prestoreFills: loadPrestoreFills(def.prestoreFills),
      };
    case 'dose_detergent':
      return { ...base, kind: 'dose_detergent' };
    case 'dose_rinse_aid':
      return {
        ...base,
        kind: 'dose_rinse_aid',
        volume: def.volumeMl === undefined ? null : mlToM3(def.volumeMl),
      };
    case 'regenerate':
      return {
        ...base,
        kind: 'regenerate',
        duration: minutesToS(def.durationMin),
        water: litres(def.waterL),
        energy: kWhToJ(def.energyKWh),
        pumpRpm: def.pumpRpm ?? null,
        diverter: def.diverter === undefined ? null : loadDiverterPattern(def.diverter),
      };
    case 'dry':
      return {
        ...base,
        kind: 'dry',
        duration: def.durationMin === undefined ? null : minutesToS(def.durationMin),
        prestoreFills: loadPrestoreFills(def.prestoreFills),
      };
  }
}

function minutesRange(r: Range | null): Range | null {
  return r === null ? null : [minutesToS(r[0]), minutesToS(r[1])];
}

/** A programme in SI units from its authoring definition. */
export function loadProgrammeSpec(def: ProgrammeDef): ProgrammeSpec {
  const printed = def.declared.printed;
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    steps: def.steps.map(loadStep),
    conditions: {
      loadHeatCapacity: def.conditions.loadHeatCapacity,
      prestoreInitialVolume: litres(def.conditions.prestoreInitialVolumeL),
      otherEnergy: kWhToJ(def.conditions.otherEnergyKWh),
    },
    declared: {
      duration: minutesToS(def.declared.durationMin),
      mainsWater: litres(def.declared.mainsWaterL),
      energy: def.declared.energyKWh === null ? null : kWhToJ(def.declared.energyKWh),
      durationTolerance: minutesToS(def.declared.durationToleranceMin),
      waterTolerance: litres(def.declared.waterToleranceL),
      energyTolerance: def.declared.energyTolerance,
      printed:
        printed === null
          ? null
          : {
              duration: minutesRange(printed.durationMin),
              energy:
                printed.energyKWh === null
                  ? null
                  : [kWhToJ(printed.energyKWh[0]), kWhToJ(printed.energyKWh[1])],
              mainsWater:
                printed.mainsWaterL === null
                  ? null
                  : [litres(printed.mainsWaterL[0]), litres(printed.mainsWaterL[1])],
            },
    },
    provenance: def.provenance,
  };
}

/** The default configuration that follows from the default states of a loaded machine. */
function defaultConfigOf(
  baskets: readonly BasketSpec[],
  cutleryBasket: CutleryBasketSpec | null,
  defaultBasketHeights: Readonly<Record<string, string>>,
): MachineConfig {
  const basketHeights: Record<string, string> = {};
  const foldedTineRows: TineRowRef[] = [];
  const shelves: ShelfState[] = [];
  for (const basket of baskets) {
    if (basket.pose.heightPositions.length > 1) {
      const wanted = defaultBasketHeights[basket.id];
      const first = basket.pose.heightPositions[0];
      if (wanted !== undefined) basketHeights[basket.id] = wanted;
      else if (first !== undefined) basketHeights[basket.id] = first.id;
    }
    for (const row of basket.tineRows) {
      if (row.hinge !== null && row.defaultState === 'folded') {
        foldedTineRows.push({ basketId: basket.id, rowId: row.id });
      }
    }
    for (const shelf of basket.cupShelves) {
      shelves.push({ basketId: basket.id, shelfId: shelf.id, state: shelf.defaultState });
    }
    for (const holder of basket.holders) {
      if (holder.folds) {
        shelves.push({ basketId: basket.id, shelfId: holder.id, state: holder.defaultState });
      }
    }
  }
  for (const id of Object.keys(defaultBasketHeights).sort()) {
    const value = defaultBasketHeights[id];
    if (basketHeights[id] === undefined && value !== undefined) basketHeights[id] = value;
  }
  return {
    basketHeights,
    foldedTineRows,
    shelves,
    cutleryBasket: cutleryBasket === null ? null : cutleryBasket.defaultPlacement,
  };
}

/**
 * Converts an authoring definition (millimetres, degrees, litres, litres per minute, grams,
 * minutes, kilowatt-hours; baskets in the dossier's own frames) into the SI specification the
 * rest of the system uses (rack frames as in docs/design/platform.md section 2).
 *
 * Throws a RangeError only for a definition that cannot be converted at all (a tine row whose
 * lean list does not match its tines, a cutlery basket placed in a basket that does not
 * exist). Everything else that may be wrong is reported by `validateMachineSpec`.
 */
export function loadMachineSpec(def: MachineDef): MachineSpec {
  const defaultCv = def.hydraulics.nozzleVelocityCoefficient;
  const baskets = def.baskets.map(loadBasket);
  const cutleryBasket =
    def.cutleryBasket === null ? null : loadCutleryBasket(def.cutleryBasket, def.baskets);
  const outer: Vec3 = v3MmToM(def.identity.outerSizeMm);
  const { outerSizeMm: _outerSizeMm, ...identityRest } = def.identity;
  void _outerSizeMm;
  const duct = def.feedDuct;
  const drying = def.drying;
  const pump = def.hydraulics.pump;
  const lPerMinPerM3PerS = 1 / lPerMinToM3PerS(1);

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    identity: { ...identityRest, outerSize: outer },
    tub: {
      x: mmRange(def.tub.xMm),
      y: mmRange(def.tub.yMm),
      z: mmRange(def.tub.zMm),
      floorDatum: def.tub.floorDatum,
      verticalCornerRadius: mm(def.tub.verticalCornerRadiusMm),
      floorSlope: deg(def.tub.floorSlopeDeg),
      floorDescription: def.tub.floorDescription,
      wheelLedgeZ: mmOrNull(def.tub.wheelLedgeZMm),
      material: def.tub.material,
      provenance: def.tub.provenance,
    },
    door: {
      flangePlaneY: mm(def.door.flangePlaneYMm),
      linerPlaneY: mm(def.door.linerPlaneYMm),
      hingeAxis: { y: mm(def.door.hingeAxisMm.y), z: mm(def.door.hingeAxisMm.z) },
      openAngle: deg(def.door.openAngleDeg),
      linerSize: def.door.linerSizeMm === null ? null : mmVec2(def.door.linerSizeMm),
      openingHeight: mmOrNull(def.door.openingHeightMm),
      provenance: def.door.provenance,
    },
    sump: {
      centre: mmVec2(def.sump.centreMm),
      diameter: mm(def.sump.diameterMm),
      depth: mm(def.sump.depthMm),
      workingVolume: litres(def.sump.workingVolumeL),
      residueAfterDrain: litres(def.sump.residueAfterDrainL),
      provenance: def.sump.provenance,
    },
    filter: {
      axis: mmVec2(def.filter.axisMm),
      flatPlate: {
        x: mmRange(def.filter.flatPlate.xMm),
        y: mmRange(def.filter.flatPlate.yMm),
        openingDiameter: mmOrNull(def.filter.flatPlate.openingDiameterMm),
        holeDiameter: mm(def.filter.flatPlate.holeDiameterMm),
        holePitch: mmOrNull(def.filter.flatPlate.holePitchMm),
        lattice: def.filter.flatPlate.lattice,
        openFraction: def.filter.flatPlate.openFraction,
        openArea: cm2ToM2(def.filter.flatPlate.openAreaCm2),
        provenance: def.filter.flatPlate.provenance,
      },
      sumpCover:
        def.filter.sumpCover === null
          ? null
          : {
              size: mmVec2(def.filter.sumpCover.sizeMm),
              y: mmRange(def.filter.sumpCover.yMm),
              holeDiameter: mm(def.filter.sumpCover.holeDiameterMm),
              holePitch: mm(def.filter.sumpCover.holePitchMm),
              openArea: cm2ToM2(def.filter.sumpCover.openAreaCm2),
              provenance: def.filter.sumpCover.provenance,
            },
      coarse: {
        diameter: mm(def.filter.coarse.diameterMm),
        length: mm(def.filter.coarse.lengthMm),
        opening: mm(def.filter.coarse.openingMm),
        crownDiameter: mmOrNull(def.filter.coarse.crownDiameterMm),
        crownTopZ: mmOrNull(def.filter.coarse.crownTopZMm),
        provenance: def.filter.coarse.provenance,
      },
      micro: {
        diameter: mmOrNull(def.filter.micro.diameterMm),
        height: mmOrNull(def.filter.micro.heightMm),
        pleatFactor: def.filter.micro.pleatFactor,
        mesh: mm(def.filter.micro.meshMm),
        area: cm2ToM2(def.filter.micro.areaCm2),
        openFraction: def.filter.micro.openFraction,
        provenance: def.filter.micro.provenance,
      },
    },
    saltCap:
      def.saltCap === null
        ? null
        : {
            centre: mmVec2(def.saltCap.centreMm),
            diameter: mm(def.saltCap.diameterMm),
            topZ: mm(def.saltCap.topZMm),
            provenance: def.saltCap.provenance,
          },
    floorFeatures: def.floorFeatures.map((f) =>
      f.kind === 'beads'
        ? {
            kind: 'beads',
            id: f.id,
            x: mmRange(f.xMm),
            y: mmRange(f.yMm),
            count: f.count,
            length: mm(f.lengthMm),
            pitch: mm(f.pitchMm),
            provenance: f.provenance,
          }
        : {
            kind: 'dish',
            id: f.id,
            centre: mmVec2(f.centreMm),
            diameter: mm(f.diameterMm),
            provenance: f.provenance,
          },
    ),
    feedDuct:
      duct === null
        ? null
        : {
            part: duct.part,
            riserX: mmRange(duct.riserXMm),
            riserProud: mm(duct.riserProudMm),
            portBlockProud: mm(duct.portBlockProudMm),
            stubEndZ: mm(duct.stubEndZMm),
            stubY: mmOrNull(duct.stubYMm),
            portZ: ascending(duct.portAboveStubEndsMm.map((h) => mm(duct.stubEndZMm + h))),
            topZ: mm(duct.stubEndZMm + duct.topAboveStubEndsMm),
            channels: duct.channels,
            provenance: duct.provenance,
          },
    wallFeatures: def.wallFeatures.map((f) => ({
      id: f.id,
      surface: f.surface,
      kind: f.kind,
      description: f.description,
      size: f.sizeMm === null ? null : mmVec2(f.sizeMm),
      position:
        f.positionMm === undefined
          ? null
          : { along: mmRange(f.positionMm.along), z: mmRange(f.positionMm.z) },
      proud: mm(f.proudMm),
      count: f.count,
      provenance: f.provenance,
    })),
    dispenser: {
      part: def.dispenser.part,
      unitSize: def.dispenser.unitSizeMm === null ? null : v3MmToM(def.dispenser.unitSizeMm),
      chamberCentre: v3MmToM(def.dispenser.chamberCentreMm),
      chamberSize: mmVec2(def.dispenser.chamberSizeMm),
      lid:
        def.dispenser.lid.kind === 'slides'
          ? def.dispenser.lid
          : {
              kind: 'swings',
              hingeEdge: def.dispenser.lid.hingeEdge,
              angle: deg(def.dispenser.lid.angleDeg),
            },
      keepOutDepth: mm(def.dispenser.keepOutDepthMm),
      fillMarks: def.dispenser.fillMarksMl.map(mlToM3),
      tabletExit: v3MmToM(def.dispenser.tabletExitMm),
      tabletTarget: def.dispenser.tabletTarget,
      rinseAidOutlet: v3MmToM(def.dispenser.rinseAidOutletMm),
      rinseAidReservoir:
        def.dispenser.rinseAidReservoirMl === null
          ? null
          : mlToM3(def.dispenser.rinseAidReservoirMl),
      rinseAidPerPulse:
        def.dispenser.rinseAidPerPulseMl === null ? null : mlToM3(def.dispenser.rinseAidPerPulseMl),
      provenance: def.dispenser.provenance,
    },
    drying: {
      method: drying.method,
      heatExchanger:
        drying.heatExchanger === null
          ? null
          : {
              part: drying.heatExchanger.part,
              wall: drying.heatExchanger.wall,
              size:
                drying.heatExchanger.sizeMm === null ? null : mmVec2(drying.heatExchanger.sizeMm),
              thickness: mmOrNull(drying.heatExchanger.thicknessMm),
              volume:
                drying.heatExchanger.volumeL === null ? null : litres(drying.heatExchanger.volumeL),
              wallConductance: drying.heatExchanger.wallConductance,
              provenance: drying.heatExchanger.provenance,
            },
      autoOpen:
        drying.autoOpen === null
          ? null
          : { after: minutesToS(drying.autoOpen.afterMin), gap: mm(drying.autoOpen.gapMm) },
      fan: drying.fan,
      defaultDuration: minutesToS(drying.defaultDurationMin),
      provenance: drying.provenance,
    },
    baskets,
    cutleryBasket,
    sprayLevels: def.sprayLevels.map((l) => loadSprayLevel(l, defaultCv)),
    hydraulics: {
      pump: {
        part: pump.part,
        type: pump.type,
        ratedSpeedRpm: pump.ratedSpeedRpm,
        shutOffHead: pump.shutOffHead,
        // b in m per (L/min)^2 times (L/min per m^3/s)^2 gives m per (m^3/s)^2.
        curveCoefficient: pump.curveCoefficientPerLMin2 * lPerMinPerM3PerS * lPerMinPerM3PerS,
        speedRangeRpm: pump.speedRangeRpm,
        hydraulicEfficiency: pump.hydraulicEfficiency,
        motorEfficiency: pump.motorEfficiency,
        idlePower: pump.idlePower,
        provenance: pump.provenance,
      },
      branches: def.hydraulics.branches.map((b) => ({
        id: b.id,
        staticLift: b.staticLift,
        liftAtPosition: b.liftAtPosition,
        lossCoefficient: b.lossCoefficient,
        pipeVolume: litres(b.pipeVolumeL),
        statedCdA: mm2ToM2(b.statedCdAMm2),
        provenance: b.provenance,
      })),
      diverter: {
        part: def.hydraulics.diverter.part,
        type: def.hydraulics.diverter.type,
        positions: def.hydraulics.diverter.positions,
        transitionTime: def.hydraulics.diverter.transitionTime,
        defaultPattern: loadDiverterPattern(def.hydraulics.diverter.defaultPattern),
        provenance: def.hydraulics.diverter.provenance,
      },
      sumpLevelBelowDatum: mm(def.hydraulics.sumpLevelBelowDatumMm),
      inventory: {
        minSumpVolume: litres(def.hydraulics.inventory.minSumpVolumeL),
        flightTime: def.hydraulics.inventory.flightTime,
        returnTime: def.hydraulics.inventory.returnTime,
        carryOver: litres(def.hydraulics.inventory.carryOverL),
        topUpVolume: litres(def.hydraulics.inventory.topUpVolumeL),
        maxTopUpsPerPhase: def.hydraulics.inventory.maxTopUpsPerPhase,
        levelCheckIn: def.hydraulics.inventory.levelCheckIn,
        provenance: def.hydraulics.inventory.provenance,
      },
      fill: {
        inletFlow: lPerMinToM3PerS(def.hydraulics.fill.inletFlowLPerMin),
        firstBathVolume: litres(def.hydraulics.fill.firstBathVolumeL),
        laterBathVolume: litres(def.hydraulics.fill.laterBathVolumeL),
        flushVolume: litres(def.hydraulics.fill.flushVolumeL),
        metering: def.hydraulics.fill.metering,
        prestoreVolume:
          def.hydraulics.fill.prestoreVolumeL === null
            ? null
            : litres(def.hydraulics.fill.prestoreVolumeL),
        prestoreDischargeFlow:
          def.hydraulics.fill.prestoreDischargeFlowLPerMin === null
            ? null
            : lPerMinToM3PerS(def.hydraulics.fill.prestoreDischargeFlowLPerMin),
        provenance: def.hydraulics.fill.provenance,
      },
      drain: {
        flow: lPerMinToM3PerS(def.hydraulics.drain.flowLPerMin),
        pattern: def.hydraulics.drain.pattern,
        provenance: def.hydraulics.drain.provenance,
      },
    },
    thermal: def.thermal,
    dosing: {
      detergentMass: gToKg(def.dosing.detergentMassG),
      detergentReleaseDelay: def.dosing.detergentReleaseDelay,
      rinseAidVolume: mlToM3(def.dosing.rinseAidVolumeMl),
      rinseAidDelay: def.dosing.rinseAidDelay,
      rinseAidMinTemperature: def.dosing.rinseAidMinTemperature,
      provenance: def.dosing.provenance,
    },
    softener:
      def.softener === null
        ? null
        : {
            setting: def.softener.setting,
            regenerateEveryCycles: def.softener.regenerateEveryCycles,
            extraWater: litres(def.softener.extraWaterL),
            extraDuration: minutesToS(def.softener.extraDurationMin),
            extraEnergy: kWhToJ(def.softener.extraEnergyKWh),
            provenance: def.softener.provenance,
          },
    sensors: def.sensors,
    programmes: def.programmes.map(loadProgrammeSpec),
    primaryProgramme: def.primaryProgramme,
    defaultConfig: defaultConfigOf(baskets, cutleryBasket, def.defaultBasketHeights),
  };
}
