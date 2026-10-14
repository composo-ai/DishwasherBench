/**
 * The player-facing level card (docs/research/benchmark.md section 3.2 a): what a user manual,
 * an open door and the person who cooked the meal would know. It is built from the level, the
 * machine specification and the catalogue, and deliberately carries nothing else: no seed, no
 * soil difficulty, no kinetic or adhesion constant, no expected outcome.
 */

import {
  GENERIC_TABLET,
  bodyMaterialOf,
  describeSoil,
  getItemType,
  instantiate,
  itemDimensionsMm,
} from '@spotless/catalogue';
import { compareIds, quantiseQuatGrid, quatToWire, roundToGrid } from '@spotless/core';
import type { MachineConfig, MachineGeometry, MachineSpec, ProgrammeSpec } from '@spotless/machine';
import {
  PROGRAMME_PHASES,
  buildMachineGeometry,
  expandProgramme,
  findMachine,
  findProgramme,
} from '@spotless/machine';
import type {
  ItemRecord,
  ItemSoilRecord,
  LevelCard,
  MachineCard,
  ProgrammeCard,
  ProgrammePhaseCard,
  RackCard,
  RackId,
  RackOptionCard,
  RulesCard,
  Vec3Mm,
} from './card-types.ts';
import { rackOptions } from './options.ts';
import { GAME_DETERGENTS, SCORED_PROGRAMME_NOTE } from './programmes.ts';
import type { Level, LevelItem, LevelSoil } from './types.ts';

/**
 * Version string of the benchmark and of this level set. 0.2.0 (2026-10-11): the levels are
 * scored on Eco 50, their soils carry the working quantities, and the set holds the six
 * redesigned starter levels and the first generated ones; nothing scored under 0.1.0 is
 * comparable.
 */
export const BENCHMARK_VERSION = 'spotless-0.2.0/levels-starter';

/** How the card states the scoring rule. */
export const SCORING_TEXT =
  'Each item that comes out of the wash clean scores its points; an item that is not clean, or that was left out of the machine, scores nothing. The verdict of the standard inspection decides: the report names the items whose verdict was at the edge of clean, or is provisional, and they count by the verdict given. A graded score is reported beside the points and does not count.';

/** How the card states what clean means (docs/design/platform.md section 6). */
export const CLEAN_DEFINITION_TEXT =
  'An item is clean when an inspection of the whole item after the cycle finds at most 4 small specks and at most 4 square millimetres of visible soil on it, counting soil that was there before, soil carried onto it from other items, and residue left where dirty water stood. Whether the item is dry is reported and does not count.';

function mm(metres: number): number {
  return roundToGrid(metres * 1000, 10);
}

function v3mm(v: readonly [number, number, number]): Vec3Mm {
  return [mm(v[0]), mm(v[1]), mm(v[2])];
}

/** The machine and configuration a level names. Throws a RangeError for an unknown machine. */
export function levelMachine(level: Level): { spec: MachineSpec; config: MachineConfig } {
  const spec = findMachine(level.machineId);
  if (spec === undefined) throw new RangeError(`levels: unknown machine '${level.machineId}'`);
  return { spec, config: level.config ?? spec.defaultConfig };
}

/** The programme a level names. Throws a RangeError for an unknown programme. */
export function levelProgramme(level: Level): ProgrammeSpec {
  const { spec } = levelMachine(level);
  const programme = findProgramme(spec, level.programmeId);
  if (programme === undefined) {
    throw new RangeError(`levels: machine '${spec.id}' has no programme '${level.programmeId}'`);
  }
  return programme;
}

const POSITION_OPTION: RackOptionCard = {
  name: 'position',
  description:
    'Whether the basket is pushed into the tub or pulled out over the open door. A basket is loaded from above while it is pulled out; whatever is in it travels with it and may shift.',
  values: ['in', 'out'],
};

/** The machine as a user manual and an open door show it. */
export function machineCard(spec: MachineSpec, geometry: MachineGeometry): MachineCard {
  const config = geometry.config;
  const options = rackOptions(spec, config);
  const optionCards = (rack: RackId): RackOptionCard[] =>
    options
      .filter((o) => o.rack === rack)
      .map((o) => ({ name: o.name, description: o.description, values: o.values }));
  const racks: RackCard[] = [];
  for (const envelope of geometry.affordances.baskets) {
    const basket = spec.baskets.find((b) => b.id === envelope.basketId);
    if (basket === undefined) continue;
    const out: [number, number, number] = [
      envelope.originTub[0] + envelope.travel.direction[0] * envelope.travel.distance,
      envelope.originTub[1] + envelope.travel.direction[1] * envelope.travel.distance,
      envelope.originTub[2] + envelope.travel.direction[2] * envelope.travel.distance,
    ];
    // The height that is clear over the whole basket (to the floor of the basket above, or
    // to the roof), and the discs under which it is less: the blades and the hub of the spray
    // arm above, the sprayer in the roof.
    const clear = Math.min(
      ...envelope.overhead.filter((o) => o.region.kind === 'everywhere').map((o) => o.clearHeight),
    );
    const lowSpots = envelope.overhead
      .filter((o) => o.region.kind === 'disc' && o.clearHeight < clear)
      .map((o) => {
        const region = o.region as { centre: readonly [number, number]; radius: number };
        return {
          under: o.id,
          clear_height_mm: mm(o.clearHeight),
          centre_mm: [
            mm(region.centre[0] - envelope.originTub[0]),
            mm(region.centre[1] - envelope.originTub[1]),
          ] as [number, number],
          radius_mm: mm(region.radius),
        };
      });
    // The tablet collecting tray is part of the basket and is given in its frame.
    const tray = basket.tabletTray;
    racks.push({
      rack: envelope.frame,
      origin_in_mm: v3mm(envelope.originTub),
      origin_out_mm: v3mm(out),
      envelope_mm: [mm(basket.outline.size[0]), mm(basket.outline.size[1]), mm(clear)],
      ...(lowSpots.length === 0 ? {} : { low_spots: lowSpots }),
      ...(tray === null
        ? {}
        : {
            tablet_tray: {
              min_mm: v3mm([
                tray.centre[0] - tray.size[0] / 2,
                tray.centre[1] - tray.size[1] / 2,
                tray.rimZ - tray.size[2],
              ]),
              max_mm: v3mm([
                tray.centre[0] + tray.size[0] / 2,
                tray.centre[1] + tray.size[1] / 2,
                tray.rimZ,
              ]),
            },
          }),
      options: [POSITION_OPTION, ...optionCards(envelope.frame)],
    });
  }
  const cutlerySpec = spec.cutleryBasket;
  if (cutlerySpec !== null) {
    // Where it stands at the start of the level; where it would stand by default when the
    // level starts with it taken out.
    const standing =
      geometry.affordances.cutleryBasket ??
      buildMachineGeometry(spec, { ...config, cutleryBasket: cutlerySpec.defaultPlacement })
        .affordances.cutleryBasket;
    const carrier = geometry.affordances.baskets.find((b) => b.basketId === standing?.basketId);
    if (standing !== null && carrier !== undefined) {
      const size = cutlerySpec.size;
      const d = carrier.travel;
      const at = standing.poseTub.p;
      const card: RackCard = {
        rack: 'cutlery_basket',
        origin_in_mm: v3mm(at),
        origin_out_mm: v3mm([
          at[0] + d.direction[0] * d.distance,
          at[1] + d.direction[1] * d.distance,
          at[2] + d.direction[2] * d.distance,
        ]),
        // The basket's frame has +y along its long side.
        envelope_mm: [mm(size[1]), mm(size[0]), mm(size[2])],
        options: optionCards('cutlery_basket'),
      };
      // Listed after the basket it stands in, as before.
      const after = racks.findIndex((r) => r.rack === carrier.frame);
      racks.splice(after + 1, 0, card);
    }
  }
  const lid = geometry.affordances.dispenserLid;
  return {
    machine_id: spec.id,
    display_name: spec.name,
    tub_min_mm: v3mm([spec.tub.x[0], spec.tub.y[0], spec.tub.z[0]]),
    tub_max_mm: v3mm([spec.tub.x[1], spec.tub.y[1], spec.tub.z[1]]),
    racks,
    spray_arms: geometry.affordances.armSweeps.map((sweep) => ({
      arm: sweep.partId,
      hub_mm: v3mm([sweep.axis[0], sweep.axis[1], sweep.zMax]),
      radius_mm: mm(sweep.radius),
      sweep_z_mm: [mm(sweep.zMin), mm(sweep.zMax)],
    })),
    dispenser: { lid_sweep_min_mm: v3mm(lid.swept.min), lid_sweep_max_mm: v3mm(lid.swept.max) },
  };
}

const programmeCards = new Map<string, ProgrammeCard>();

/**
 * The programme as a manual prints it: phases with nominal temperature and duration, what is
 * put in the dispenser (the detergent the game washes this machine with, `programmes.ts`; the
 * machine's own generic tablet where it has none), and that it is the scored programme.
 */
export function programmeCard(spec: MachineSpec, programme: ProgrammeSpec): ProgrammeCard {
  const key = `${spec.id}/${programme.id}`;
  const cached = programmeCards.get(key);
  if (cached !== undefined) return cached;
  const timeline = expandProgramme(spec, programme);
  const phases: ProgrammePhaseCard[] = [];
  for (const phase of PROGRAMME_PHASES) {
    const segments = timeline.segments.filter((s) => s.phase === phase);
    if (segments.length === 0 || phase === 'start') continue;
    let duration = 0;
    let target: number | null = null;
    for (const segment of segments) {
      duration += segment.end - segment.start;
      if (segment.target !== null) target = Math.max(target ?? -Infinity, segment.target);
    }
    phases.push({ name: phase, temperature_c: target, duration_s: Math.round(duration) });
  }
  const own = GAME_DETERGENTS[spec.id];
  const card: ProgrammeCard = {
    programme_id: programme.id,
    display_name: programme.name,
    phases,
    detergent:
      own !== undefined
        ? { type: own.type, dose_g: own.doseG, name: own.name }
        : spec.dosing.detergentMass > 0
          ? { type: GENERIC_TABLET.id, dose_g: roundToGrid(spec.dosing.detergentMass * 1000, 10) }
          : null,
    status: 'scored',
    note: SCORED_PROGRAMME_NOTE,
  };
  programmeCards.set(key, card);
  return card;
}

/** How the card describes one soil of an item: the level's own words, or the catalogue's. */
export function soilRecord(item: LevelItem, soil: LevelSoil): ItemSoilRecord {
  const type = getItemType(item.itemType);
  const labels = soil.regions.map(
    (r) => type.surfaceRegions.find((s) => s.id === r.region)?.label ?? r.region,
  );
  return {
    description:
      soil.description ??
      describeSoil(soil.type, {
        ageH: soil.ageH,
        heatHistory: soil.heatHistory,
        regionLabels: labels,
      }),
    type: soil.type,
    regions: soil.regions.map((r) => ({ region: r.region, coverage: r.coverage })),
    amount_g: soil.amountG,
    age_h: soil.ageH,
    heat_history: soil.heatHistory,
  };
}

/** The record of one item on the card (without thumbnails). */
export function itemRecord(item: LevelItem): ItemRecord {
  const type = getItemType(item.itemType);
  const instance = instantiate(item.itemType);
  const { min, max } = instance.bbox;
  return {
    item_id: item.id,
    class: type.itemClass,
    display_name: type.name,
    material: bodyMaterialOf(type),
    mass_kg: roundToGrid(instance.mass.mass, 10000),
    bbox_mm: v3mm([max[0] - min[0], max[1] - min[1], max[2] - min[2]]),
    reference_point_mm: v3mm(instance.referencePoint),
    dims: itemDimensionsMm(type),
    orientation_presets: instance.stablePoses.map((pose) => {
      const grid = quantiseQuatGrid(pose.q);
      if (grid === null) throw new RangeError(`levels: pose '${pose.name}' of '${type.id}'`);
      const described = type.placement.stablePoses.find((p) => p.name === pose.name);
      return {
        name: pose.name,
        quat_wxyz: quatToWire(grid),
        ...(described === undefined ? {} : { description: described.description }),
      };
    }),
    soils: item.soils.map((soil) => soilRecord(item, soil)),
    points: item.points,
  };
}

/** The rules of a level in words and numbers. */
export function rulesCard(level: Level): RulesCard {
  const washes = level.rules.washesMax;
  return {
    track: level.rules.track,
    scoring: SCORING_TEXT,
    clean_definition: CLEAN_DEFINITION_TEXT,
    budgets: {
      actions_max: level.rules.actionsMax,
      queries_max: level.rules.queriesMax,
      washes_max: washes,
    },
    episode_end:
      washes === 1
        ? 'The episode ends when the cycle is started: the baskets are pushed in, the load is frozen and washed once. When the action budget is used up the cycle can still be started with whatever is loaded.'
        : `The episode ends after ${washes} cycles. When the action budget is used up a cycle can still be started with whatever is loaded.`,
    mechanical_checks: level.rules.mechanicalChecks,
    exact_placement: level.rules.exactPlacement === true,
  };
}

/**
 * The level card of a level. Throws a RangeError for a level that `validateLevel` rejects
 * (unknown machine, programme, item type or soil): validate level data before building cards.
 * `geometry` may be passed by a caller that has already built it for the level's configuration.
 */
export function levelCard(level: Level, geometry?: MachineGeometry): LevelCard {
  const { spec, config } = levelMachine(level);
  const programme = levelProgramme(level);
  return {
    benchmark_version: BENCHMARK_VERSION,
    level_id: level.id,
    title: level.title,
    summary: level.summary,
    machine: machineCard(spec, geometry ?? buildMachineGeometry(spec, config)),
    programme: programmeCard(spec, programme),
    secondary_programmes: [],
    items: [...level.items].sort((a, b) => compareIds(a.id, b.id)).map(itemRecord),
    rules: rulesCard(level),
    manual: level.manual,
  };
}
